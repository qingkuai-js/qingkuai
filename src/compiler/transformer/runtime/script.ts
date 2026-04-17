import type {
    Identifier,
    TSEnumDeclaration,
    VariableDeclarator,
    VariableDeclaration
} from "@babel/types"
import type { CodeEditor } from "../editor"
import type { AnyNode, IntrinsicCall } from "#type-declarations/estree"
import type { TopLevelIdentifierInfo } from "#type-declarations/compiler"

import { RuntimeCodeWriter } from "../writer"
import { arrayFrom } from "../../../util/shared/arrays"
import { stripTypeExpressions } from "../../estree/sundry"
import { jsDestructuringEqualTokenRE } from "../../regular"
import { findOutOfComment } from "../../../util/compiler/string"
import { ensureIdWithNumSuffix } from "../../../util/compiler/sundry"
import { replaceReusedStringReferences } from "../../optimizer/compress"
import { newCleanObj, traverseObject } from "../../../util/shared/sundry"
import { analyzeResult, generateIdentifier, inputDescriptor } from "../../state"

export function transformEmbeddedScript(hoistWriter: RuntimeCodeWriter, editor: CodeEditor) {
    const internalId = generateIdentifier.internal
    const debugMode = inputDescriptor.options.debug
    const scriptSource = inputDescriptor.script.code
    const undefId = `${generateIdentifier.internal}.UNDEF`
    const identifierMap: Record<string, string> = newCleanObj()
    const { declaratorToIntrinsic, topLevelIdentifiers, topLevelReferences } = analyzeResult.script

    // 用于记录已被处理的 VariableDeclarator，解构或 var 声明的多个标识符指向同一个 VariableDeclarator
    // Used to record VariableDeclarators that have already been processed.
    // Multiple identifiers in a destructuring or `var` declaration may point to the same VariableDeclarator.
    const processedItems = new Set<VariableDeclarator | TSEnumDeclaration>()

    // 调试模式下衍生响应式值标识符在编译后不能是常量，因为目标被修改后需要通过 setter 同步修原始始标识符
    // In debug mode, derived reactive value identifiers must not be constants after compilation,
    // because when the target is modified, the original identifier needs to be synchronized via a setter.
    const convertToLetKeywordDeclarators = new Map<VariableDeclarator, VariableDeclaration>()
    traverseObject(topLevelIdentifiers, (_, value) => {
        const declaration = value.nodeInfos[0].declaration
        if (
            debugMode &&
            declaration.type === "VariableDeclaration" &&
            declaration.kind === "const" &&
            (value.status === "alias" || value.status === "derived")
        ) {
            convertToLetKeywordDeclarators.set(
                value.nodeInfos[0].declarator as VariableDeclarator,
                declaration
            )
        }
    })
    for (const [declarator, declaration] of convertToLetKeywordDeclarators) {
        const { declarations } = declaration
        const declaratorIndex = declarations.indexOf(declarator)
        if (declaratorIndex !== 0) {
            editor.insert(declarator.start!, "let ")
            replaceCommaWithSemi(declarations[declaratorIndex - 1])
        } else {
            editor.replace(declaration.start!, declaration.start! + 5, "let", true)
        }
        for (let i = declaratorIndex + 1; i < declarations.length; i++) {
            if (!convertToLetKeywordDeclarators.has(declarations[i])) {
                replaceCommaWithSemi(declarations[i - 1])
                editor.insert(declarations[i].start!, "const ")
                break
            }
            convertToLetKeywordDeclarators.delete(declarations[i])
        }
    }

    traverseObject(topLevelIdentifiers, (name, info) => {
        switch (info.status) {
            case "pending": {
                return
            }
            case "raw":
            case "literal": {
                return transformRawDecalration(info)
            }
            case "shallow":
            case "reactive": {
                transformReactiveDeclaration(name, info)
                info.transofrmedTo = identifierMap[name] ?? name
                return (info.transofrmedTo += info.accessor ? ".$" : "")
            }
            case "derived": {
                transformDerivedDeclaration(name, info)
                return (info.transofrmedTo = `${identifierMap[name] ?? name}.$`)
            }
            case "alias": {
                transformAliasDeclaration(name, info)

                if (!debugMode) {
                    info.transofrmedTo = info.path
                } else {
                    info.transofrmedTo = `${name}[${internalId}.REFERENCE_VALUE]`
                }
                return
            }
        }
    })

    // 转换响应式标识符引用
    // Transform reactive identifier references
    traverseObject(topLevelIdentifiers, (name, info) => {
        if (topLevelReferences[name]) {
            for (const reference of topLevelReferences[name]) {
                const { hoist, transofrmedTo, status } = info
                if (!transofrmedTo) {
                    continue
                }
                if (status !== "alias" && !hoist && !reference.declared) {
                    continue
                }
                if (!reference.shorthand) {
                    editor.replace(...reference.range, `${transofrmedTo}`, true)
                } else {
                    editor.insert(reference.range[1], `: ${transofrmedTo}`, reference.range)
                }
            }
        }
    })

    // 转换监视器创建调用
    // Transform watcher creation calls
    for (const call of analyzeResult.script.watchers) {
        const firstArg = call.arguments[0]
        if (shouldNodeWrapAsGetter(firstArg)) {
            editor.insert(firstArg.end!, ")")
            editor.insert(firstArg.start!, `() => (`)
        }
        editor.insert(call.callee.start!, `${internalId}.`)
    }
    replaceReusedStringReferences(editor, analyzeResult.script.reusedStringReferences)

    function transformRawDecalration(info: TopLevelIdentifierInfo) {
        for (const { declarator } of info.nodeInfos) {
            if (
                declarator.type === "VariableDeclarator" &&
                declaratorToIntrinsic.has(declarator) &&
                !processedItems.has(declarator)
            ) {
                replaceIntrinsicCall(declarator, "", hasArg => {
                    return hasArg ? undefined : undefId
                })
            }
        }
    }

    function transformDerivedDeclaration(name: string, info: TopLevelIdentifierInfo) {
        const declarator = info.nodeInfos[0].declarator as VariableDeclarator
        const withIntrinsic = analyzeResult.script.declaratorToIntrinsic.has(declarator)
        const intrinsicInfo = withIntrinsic ? getIntrinsicInfo(declarator) : undefined
        const byExpression = intrinsicInfo?.id.name === "derivedExp"
        if (!info.destructuringIdentifierNames) {
            if (intrinsicInfo) {
                const firstArg = intrinsicInfo.call.arguments[0]
                if (byExpression && shouldNodeWrapAsGetter(firstArg)) {
                    editor.insert(firstArg.end!, ")")
                    editor.insert(firstArg.start!, "() => (")
                }
                if (debugMode) {
                    editor.insert(firstArg.end!, `, ${generateHoistSetter(name)}`)
                }
                replaceIntrinsicCall(declarator, "derived")
            } else {
                // 断言：此时一定存在初始值（不然会退化为原始值）
                // Assertion: at this point, an initializer must exist
                // (otherwise it would have been downgraded to the raw value).
                const initNode = declarator.init!
                const shouldWrapAsGetter = shouldNodeWrapAsGetter(initNode)
                editor.insertMulti(initNode.start!, [
                    internalId,
                    ".derived(",
                    shouldWrapAsGetter ? "() => (" : ""
                ])
                editor.insertMulti(initNode.end!, [
                    shouldWrapAsGetter ? ")" : "",
                    debugMode ? `, ${generateHoistSetter(name)}` : "",
                    ")"
                ])
            }
            return transformNonDestructuringDeclaratorId(declarator)
        }

        if (processedItems.has(declarator)) {
            return
        }

        const firstArg = intrinsicInfo!.call.arguments[0]
        if (byExpression && shouldNodeWrapAsGetter(firstArg)) {
            editor.insert(firstArg.end!, ")")
            editor.insert(firstArg.start!, "() => (")
        }
        if (debugMode) {
            const destructuringIds = info.destructuringIdentifierNames.map(item => {
                return `[${getReactiveIdentifier(item)}, ${item}]`
            })
            editor.insertMulti(declarator.id.start!, [
                {
                    sourceRange: declarator.id.range!,
                    value: `[${destructuringIds.join(", ")}]`
                },
                {
                    value: `= ${internalId}.`
                }
            ])
        } else {
            editor.insert(
                declarator.id.start!,
                `[${info.destructuringIdentifierNames.join(", ")}] = ${internalId}.`
            )
        }
        editor.insertMulti(declarator.id.start!, [
            {
                value: "destructuringDerived",
                sourceRange: intrinsicInfo?.id.range
            },
            {
                value: "(("
            }
        ])
        replaceIntrinsicCall(declarator, "", () => {
            const segments: string[] = []
            const names = info.destructuringIdentifierNames!
            if ((segments.push(`, ${names.length}`), debugMode)) {
                segments.push(`, [${names.map(generateHoistSetter).join(", ")}]`)
            }
            return segments.join("") + ")"
        })
        transformDestructuringEqualSign(declarator, info.destructuringIdentifierNames)
    }

    function transformAliasDeclaration(name: string, info: TopLevelIdentifierInfo) {
        const declarator = info.nodeInfos[0].declarator as VariableDeclarator
        const { declarations } = info.nodeInfos[0].declaration as VariableDeclaration
        const { call: intrinsicCall, id: intrinsicId } = getIntrinsicInfo(declarator)!
        const aliasInfos = analyzeResult.script.declaratorToAliasInfos.get(declarator)!

        // 移除 VariableDeclarator 多余的尾部逗号
        // Remove any trailing comma from the VariableDeclarator.
        if (!debugMode) {
            if (declarations.length !== 1) {
                let declaratorToRemoveEndComma: VariableDeclarator
                const declaratorIndex = declarations.indexOf(declarator)
                if (declaratorIndex !== declarations.length - 1) {
                    declaratorToRemoveEndComma = declarator
                } else {
                    declaratorToRemoveEndComma = declarations[declaratorIndex - 1]
                }
                editor.removeCharacter(
                    declaratorToRemoveEndComma.end! +
                        findEndCommaIndexOfVariableDeclarator(declaratorToRemoveEndComma)
                )
            }
            return
        }

        if (!info.destructuringIdentifierNames) {
            editor.replace(
                ...intrinsicCall.arguments[0].range!,
                generateHoistGetter(`[${aliasInfos[0].target}, ${aliasInfos[0].property}]`)
            )
            editor.insert(intrinsicId.start!, `${internalId}.`)
            return
        }

        if (processedItems.has(declarator)) {
            return
        }

        const getterIds: string[] = []
        const declaratorIdRange = declarator.id.range!
        const joinedDestructuringIds = info.destructuringIdentifierNames.join(", ")
        for (const aliasInfo of aliasInfos) {
            getterIds.push(generateHoistGetter(`[${aliasInfo.target}, ${aliasInfo.property}]`))
        }
        editor.insert(intrinsicCall.arguments[0].end!, `${getterIds.join(", ")}`)
        editor.remove(...declaratorIdRange)
        editor.remove(...intrinsicCall.arguments[0].range!)
        replaceIntrinsicCall(declarator, "destructuringAlias")
        editor.insert(declarator.id.start!, `[${joinedDestructuringIds}]`, declaratorIdRange)
    }

    function transformReactiveDeclaration(name: string, info: TopLevelIdentifierInfo) {
        const reactiveIdentifier = shouldGenerateReactiveIdentifier(info)
            ? getReactiveIdentifier(name)
            : name
        const isShallow = info.status === "shallow"
        const firstDeclaration = info.nodeInfos[0].declaration
        const defaultReactFunc = isShallow ? "shallowReact" : "react"
        const defaultReactCallee = `${internalId}.${defaultReactFunc}`

        // ClassDeclaration
        if (firstDeclaration.type === "ClassDeclaration") {
            if (debugMode) {
                editor.insert(
                    firstDeclaration.start!,
                    `let [${reactiveIdentifier}, ${name}] = ${defaultReactCallee}(`
                )
                editor.insert(firstDeclaration.end!, `, ${generateHoistSetter(name)})`)
            } else {
                editor.insert(firstDeclaration.end!, ")")
                editor.insert(firstDeclaration.start!, `let ${name} = ${defaultReactCallee}(`)
            }
            return
        }

        // TSEnumDeclaration
        if (firstDeclaration.type === "TSEnumDeclaration") {
            if (debugMode) {
                editor.insert(
                    firstDeclaration.start!,
                    `const [${reactiveIdentifier}] = ${defaultReactCallee}({}, ${generateSetterCode(
                        name
                    )})\n${inputDescriptor.indent}`
                )
            } else {
                editor.insert(
                    firstDeclaration.start!,
                    `const ${reactiveIdentifier} = ${defaultReactCallee}({})\n${inputDescriptor.indent}`
                )
            }
            for (const { declaration } of info.nodeInfos) {
                const writer = new RuntimeCodeWriter().indent()
                editor.insert(
                    declaration.end!,
                    writer.write(
                        isShallow
                            ? `${reactiveIdentifier}.$ = ${name};`
                            : `${internalId}.objectAssign(${reactiveIdentifier}.$ ??= {}, ${name});`
                    ).code
                )
            }
            return
        }

        // VariableDeclaration(kind: var) || FunctionDeclaration
        if (info.hoist) {
            const isFunctionDeclaration = firstDeclaration.type === "FunctionDeclaration"
            if (!isFunctionDeclaration) {
                for (const nodeInfo of info.nodeInfos) {
                    const declarator = nodeInfo.declarator as VariableDeclarator
                    const declaration = nodeInfo.declaration as VariableDeclaration
                    if (processedItems.has(declarator)) {
                        continue
                    }
                    processedItems.add(declarator)

                    if (declaratorToIntrinsic.has(declarator)) {
                        replaceIntrinsicCall(declarator, "", hasArg =>
                            hasArg ? undefined : undefId
                        )
                    }

                    const declaratorIndex = declaration.declarations.indexOf(declarator)
                    if (declaratorIndex === declaration.declarations.length - 1) {
                        editor.insert(declarator.end!, ";")
                    } else {
                        replaceCommaWithSemi(declarator)
                        editor.insert(declaration.declarations[declaratorIndex + 1].start!, "var ")
                    }
                    if (nodeInfo.destructuringIdentifierNames) {
                        const shouldUpdateItems = new Set<string>()
                        for (const item of nodeInfo.destructuringIdentifierNames) {
                            const { status } = analyzeResult.script.topLevelIdentifiers[item]
                            if (status === "reactive" || status === "shallow") {
                                shouldUpdateItems.add(item)
                            }
                        }

                        const shouldUpdateItemsArr = arrayFrom(shouldUpdateItems)
                        const shouldUpdateTargetsArr = shouldUpdateItemsArr.map(
                            item => `${getReactiveIdentifier(item)}.$`
                        )
                        editor.insert(
                            declarator.end!,
                            ` [${shouldUpdateTargetsArr.join(", ")}] = [${shouldUpdateItemsArr.join(", ")}];`
                        )
                    } else {
                        editor.insert(declarator.end!, ` ${reactiveIdentifier}.$ = ${name};`)
                    }
                }
            }

            const reactiveTarget = isFunctionDeclaration ? name : undefId
            if (debugMode) {
                hoistWriter.write(`const [${reactiveIdentifier}] = ${defaultReactCallee}(`)
                hoistWriter.write(`${reactiveTarget}, ${generateSetterCode(name)})\n`)
            } else {
                hoistWriter.write(
                    `const ${reactiveIdentifier} = ${defaultReactCallee}(${reactiveTarget})\n`
                )
            }
            return
        }

        // VariableDeclaration(non-var)
        const declarator = info.nodeInfos[0].declarator as VariableDeclarator
        const isConst = (firstDeclaration as VariableDeclaration).kind !== "let"
        if (!declarator.init) {
            if (!debugMode) {
                editor.insert(declarator.id.end!, ` = ${defaultReactCallee}()`)
            } else {
                // assertion: non-const
                editor.insert(
                    declarator.id.end!,
                    `] = ${defaultReactCallee}(${undefId}, ${generateHoistSetter(name)})`
                )
                editor.insert(declarator.id.start!, `[${reactiveIdentifier}, `)
            }
            return
        }

        if (!info.destructuringIdentifierNames) {
            const reactFunc = isConst
                ? isShallow
                    ? "shallowConstReact"
                    : "constReact"
                : defaultReactFunc
            if (debugMode && !isConst) {
                transformNonDestructuringDeclaratorId(declarator)
            }
            if (!info.implicit) {
                replaceIntrinsicCall(declarator, reactFunc, hasArg => {
                    if (!debugMode) {
                        return
                    }
                    if (!hasArg) {
                        return `${undefId}, ${generateHoistSetter(name)}`
                    }
                    return isConst ? "" : `, ${generateHoistSetter(name)}`
                })
            } else {
                if (debugMode && !isConst) {
                    editor.insert(declarator.init.end!, `, ${generateHoistSetter(name)}`)
                }
                editor.insert(declarator.init.end!, ")")
                editor.insert(declarator.init.start!, `${internalId}.${reactFunc}(`)
            }
            return
        }

        if (processedItems.has(declarator)) {
            return
        }
        processedItems.add(declarator)

        const setterIds: string[] = []
        const needSetters = debugMode && !isConst
        const { destructuringIdentifierNames } = info
        const destructuringFuncReturnItems = destructuringIdentifierNames.map((item, index) => {
            const { status } = analyzeResult.script.topLevelIdentifiers[item]
            const isReactive = status === "shallow" || status === "reactive"
            if (needSetters && (isReactive || index !== destructuringIdentifierNames.length - 1)) {
                setterIds.push(isReactive ? generateHoistSetter(item) : "")
            }
            return `[${item}, ${+isReactive}]`
        })

        // Declaration id and react call
        if (!needSetters) {
            editor.insert(
                declarator.id.start!,
                `[${destructuringIdentifierNames.join(", ")}] = ${internalId}.`
            )
        } else {
            const destructuringIds = destructuringIdentifierNames.map(item => {
                const { status } = analyzeResult.script.topLevelIdentifiers[item]
                const isReactive = status === "shallow" || status === "reactive"
                return isReactive ? `[${getReactiveIdentifier(item)}, ${item}]` : item
            })
            editor.insertMulti(declarator.id.start!, [
                {
                    sourceRange: declarator.id.range!,
                    value: `[${destructuringIds.join(", ")}]`
                },
                {
                    value: ` = ${internalId}.`
                }
            ])
        }
        editor.insert(
            declarator.id.start!,
            `destructuring${isShallow ? "Shallow" : ""}${isConst ? "Const" : ""}React`,
            getIntrinsicInfo(declarator)?.id.range
        )
        editor.insert(declarator.id.start!, "((")
        transformDestructuringEqualSign(declarator, destructuringFuncReturnItems)

        // Reactive target and debugging setters
        if (!info.implicit) {
            replaceIntrinsicCall(declarator, "", hasArg => {
                if (hasArg) {
                    return `${needSetters ? `, [${setterIds.join(", ")}])` : ")"}`
                }
                return `${undefId}${needSetters ? `, [${setterIds.join(", ")}])` : ")"}`
            })
        } else {
            editor.insert(declarator.end!, `${needSetters ? `, [${setterIds.join(", ")}])` : ")"}`)
        }
        return
    }

    function replaceIntrinsicCall(
        declarator: VariableDeclarator,
        newName: string,
        insertArg?: (hasArg: boolean) => string | undefined
    ) {
        const { call, id } = getIntrinsicInfo(declarator)!
        const initNodeStart = declarator.init!.start!
        const insertArgRet = insertArg?.(!!call.arguments.length)

        if ((processedItems.add(declarator), insertArgRet)) {
            if (call.arguments.length) {
                editor.insert(call.arguments[0].end!, insertArgRet)
            } else {
                editor.insert(call.end! - 1, insertArgRet)
            }
        }
        if (newName !== "") {
            editor.insert(id.start!, `${internalId}.`)
            editor.replace(...id.range!, newName, true)
        } else {
            if (!call.arguments.length) {
                editor.remove(initNodeStart, call.end! - 1)
            } else {
                editor.remove(call.arguments[0].end!, call.end! - 1)
                editor.remove(initNodeStart, call.arguments[0].start!)
            }
            editor.remove(call.end! - 1, call.end!)
        }
    }

    function replaceCommaWithSemi(declarator: VariableDeclarator) {
        const declaratorEnd = declarator.end!
        const commaIndex = findEndCommaIndexOfVariableDeclarator(declarator)
        if (commaIndex !== -1) {
            editor.replace(declaratorEnd + commaIndex, declaratorEnd + commaIndex + 1, ";")
        }
    }
    function getReactiveIdentifier(name: string) {
        return (identifierMap[name] ??= ensureIdWithNumSuffix("_" + name, true))
    }

    function generateHoistGetter(returns: string) {
        const getterId = ensureIdWithNumSuffix("_G")
        const getterArgId = generateIdentifier.getterArg
        return (hoistWriter.write(`const ${getterId} = ${getterArgId} => (${returns})\n`), getterId)
    }

    function generateHoistSetter(target: string) {
        const setterId = ensureIdWithNumSuffix("_S")
        return (hoistWriter.write(`const ${setterId} = ${generateSetterCode(target)}\n`), setterId)
    }

    function transformNonDestructuringDeclaratorId(declarator: VariableDeclarator) {
        if (debugMode) {
            const idNode = declarator.id as Identifier
            editor.replace(
                ...idNode.range!,
                `[${getReactiveIdentifier(idNode.name)}, ${idNode.name}]`,
                true
            )
        }
    }

    function transformDestructuringEqualSign(declarator: VariableDeclarator, returns: string[]) {
        const [matchedIndex, matchedLen] = findOutOfComment(
            scriptSource.slice(declarator.id.end!),
            jsDestructuringEqualTokenRE
        )
        const equalSignIndex = declarator.id.end! + matchedIndex
        editor.replace(
            equalSignIndex,
            equalSignIndex + matchedLen,
            `) => [${returns.join(", ")}], `
        )
    }
}

function shouldNodeWrapAsGetter(node: AnyNode) {
    switch (stripTypeExpressions(node).type) {
        case "FunctionExpression":
        case "ArrowFunctionExpression": {
            return false
        }
    }
    return true
}

function generateSetterCode(target: string) {
    const setterArgId = generateIdentifier.setterArg
    return `${setterArgId} => (${target} = ${setterArgId})`
}

function shouldGenerateReactiveIdentifier(info: TopLevelIdentifierInfo) {
    const debugMode = inputDescriptor.options.debug
    const firstDeclaration = info.nodeInfos[0].declaration
    switch (firstDeclaration.type) {
        case "ClassDeclaration": {
            return debugMode
        }
        case "TSEnumDeclaration":
        case "FunctionDeclaration": {
            return true
        }
        default: {
            switch (firstDeclaration.kind) {
                case "var": {
                    return true
                }
                case "let": {
                    return debugMode
                }
                default: {
                    return false
                }
            }
        }
    }
}

function getIntrinsicInfo(declarator: VariableDeclarator) {
    const context = analyzeResult.script.declaratorToIntrinsic.get(declarator)!
    if (context) {
        return {
            context,
            id: context.value,
            call: context.striptTypeOperationsParent!.value as IntrinsicCall
        }
    }
}

function findEndCommaIndexOfVariableDeclarator(declarator: VariableDeclarator) {
    return findOutOfComment(inputDescriptor.script.code.slice(declarator.end!), ",")
}
