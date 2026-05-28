import type { CodeEditor } from "../editor"
import type { TopLevelIdentifierInfo } from "#type-declarations/compiler"

import ts from "typescript"

import {
    getNodeRange,
    getVariableDeclareKeyword,
    getStriptTypeOperationsNode,
    getStriptTypeOperationsParent
} from "../../ts-ast/sundry"
import { RuntimeCodeWriter } from "../writer"
import { arrayFrom } from "../../../util/shared/arrays"
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
    const processedItems = new Set<ts.VariableDeclaration | ts.EnumDeclaration>()

    // 调试模式下衍生响应式值标识符在编译后不能是常量，因为目标被修改后需要通过 setter 同步修原始始标识符
    // In debug mode, derived reactive value identifiers must not be constants after compilation,
    // because when the target is modified, the original identifier needs to be synchronized via a setter.
    const convertToLetKeywordDecs = new Map<ts.VariableDeclaration, ts.VariableDeclarationList>()
    if (debugMode) {
        traverseObject(topLevelIdentifiers, (_, value) => {
            const declaration = value.nodeInfos[0].declaration
            if (
                (value.status === "alias" || value.status === "derived") &&
                ts.isVariableDeclarationList(declaration) &&
                getVariableDeclareKeyword(declaration) === "const"
            ) {
                const declarator = value.nodeInfos[0].declarator as ts.VariableDeclaration
                convertToLetKeywordDecs.set(declarator, declaration)
            }
        })
    }
    for (const [declarator, declaration] of convertToLetKeywordDecs) {
        const { declarations } = declaration
        const declaratorIndex = declarations.indexOf(declarator)
        if (declaratorIndex !== 0) {
            editor.insert(declarator.getStart(), "let ")
            replaceCommaWithSemi(declarations[declaratorIndex - 1])
        } else {
            editor.replace(declaration.getStart(), declaration.getStart() + 5, "let", true)
        }
        for (let i = declaratorIndex + 1; i < declarations.length; i++) {
            if (!convertToLetKeywordDecs.has(declarations[i])) {
                replaceCommaWithSemi(declarations[i - 1])
                editor.insert(declarations[i].getStart(), "const ")
                break
            }
            convertToLetKeywordDecs.delete(declarations[i])
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
                info.transofrmeTo = identifierMap[name] ?? name
                return (info.transofrmeTo += info.accessor ? ".$" : "")
            }
            case "derived": {
                transformDerivedDeclaration(name, info)
                return (info.transofrmeTo = `${identifierMap[name] ?? name}.$`)
            }
            case "alias": {
                transformAliasDeclaration(name, info)

                if (!debugMode) {
                    info.transofrmeTo = info.aliasTarget
                } else {
                    info.transofrmeTo = `${name}[${internalId}.REFERENCE_VALUE]`
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
                const { hoist, transofrmeTo: transofrmedTo, status } = info
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
            editor.insert(firstArg.getEnd(), ")")
            editor.insert(firstArg.getStart(), `() => (`)
        }
        editor.insert(call.expression.getStart(), `${internalId}.`)
    }
    replaceReusedStringReferences(editor, analyzeResult.script.reusedStringReferences)

    function transformRawDecalration(info: TopLevelIdentifierInfo) {
        for (const { declarator } of info.nodeInfos) {
            if (
                ts.isVariableDeclaration(declarator) &&
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
        const destructuringIdentifierNames = info.nodeInfos[0].destructuringIdentifierNames
        const declarator = info.nodeInfos[0].declarator as ts.VariableDeclaration
        const withIntrinsic = analyzeResult.script.declaratorToIntrinsic.has(declarator)
        const intrinsicInfo = withIntrinsic ? getIntrinsicInfo(declarator) : undefined
        const byExpression = intrinsicInfo?.id.text === "derivedExp"
        if (!destructuringIdentifierNames) {
            if (intrinsicInfo) {
                const firstArg = intrinsicInfo.call.arguments[0]
                if (byExpression && shouldNodeWrapAsGetter(firstArg)) {
                    editor.insert(firstArg.getEnd(), ")")
                    editor.insert(firstArg.getStart(), "() => (")
                }
                if (debugMode) {
                    editor.insert(firstArg.getEnd(), `, ${generateHoistSetter(name)}`)
                }
                replaceIntrinsicCall(declarator, "derived")
            } else {
                // 断言：此时一定存在初始值（不然会退化为原始值）
                // Assertion: at this point, an initializer must exist
                // (otherwise it would have been downgraded to the raw value).
                const initNode = declarator.initializer!
                const shouldWrapAsGetter = shouldNodeWrapAsGetter(initNode)
                editor.insertMulti(initNode.getStart(), [
                    internalId,
                    ".derived(",
                    shouldWrapAsGetter ? "() => (" : ""
                ])
                editor.insertMulti(initNode.getEnd(), [
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
            editor.insert(firstArg.getEnd(), ")")
            editor.insert(firstArg.getStart(), "() => (")
        }
        if (debugMode) {
            const destructuringIds = destructuringIdentifierNames.map(item => {
                return `[${getReactiveIdentifier(item)}, ${item}]`
            })
            editor.insertMulti(declarator.name.getStart(), [
                {
                    value: `[${destructuringIds.join(", ")}]`,
                    sourceRange: getNodeRange(declarator.name)
                },
                {
                    value: `= ${internalId}.`
                }
            ])
        } else {
            editor.insert(
                declarator.name.getStart(),
                `[${destructuringIdentifierNames.join(", ")}] = ${internalId}.`
            )
        }
        editor.insertMulti(declarator.name.getStart(), [
            {
                value: "destructuringDerived",
                sourceRange: intrinsicInfo && getNodeRange(intrinsicInfo.id)
            },
            {
                value: "(("
            }
        ])
        replaceIntrinsicCall(declarator, "", () => {
            const segments: string[] = []
            if ((segments.push(`, ${destructuringIdentifierNames.length}`), debugMode)) {
                segments.push(
                    `, [${destructuringIdentifierNames.map(generateHoistSetter).join(", ")}]`
                )
            }
            return segments.join("") + ")"
        })
        transformDestructuringEqualSign(declarator, destructuringIdentifierNames)
    }

    function transformAliasDeclaration(_: string, info: TopLevelIdentifierInfo) {
        const declarator = info.nodeInfos[0].declarator as ts.VariableDeclaration
        const destructuringIdentifierNames = info.nodeInfos[0].destructuringIdentifierNames
        const { declarations } = info.nodeInfos[0].declaration as ts.VariableDeclarationList
        const { call: intrinsicCall, id: intrinsicId } = getIntrinsicInfo(declarator)!
        const aliasInfos = analyzeResult.script.declaratorToAliasInfos.get(declarator)!

        // 移除 VariableDeclarator 多余的尾部逗号
        // Remove any trailing comma from the VariableDeclarator.
        if (!debugMode) {
            if (declarations.length !== 1) {
                let declaratorToRemoveEndComma: ts.VariableDeclaration
                const declaratorIndex = declarations.indexOf(declarator)
                if (declaratorIndex !== declarations.length - 1) {
                    declaratorToRemoveEndComma = declarator
                } else {
                    declaratorToRemoveEndComma = declarations[declaratorIndex - 1]
                }
                editor.removeCharacter(
                    declaratorToRemoveEndComma.getEnd() +
                        findEndCommaIndexOfVariableDeclarator(declaratorToRemoveEndComma)
                )
            }
            return
        }

        if (!destructuringIdentifierNames) {
            editor.replace(
                ...getNodeRange(intrinsicCall.arguments[0]),
                generateHoistGetter(`[${aliasInfos[0].expression}, ${aliasInfos[0].property}]`)
            )
            editor.insert(intrinsicId.getStart(), `${internalId}.`)
            return
        }

        if (processedItems.has(declarator)) {
            return
        }

        const getterIds: string[] = []
        const declaratorIdRange = getNodeRange(declarator.name)
        const joinedDestructuringIds = destructuringIdentifierNames.join(", ")
        for (const aliasInfo of aliasInfos) {
            getterIds.push(generateHoistGetter(`[${aliasInfo.expression}, ${aliasInfo.property}]`))
        }
        editor.insert(intrinsicCall.arguments[0].getEnd(), `${getterIds.join(", ")}`)
        editor.remove(...declaratorIdRange)
        editor.remove(...getNodeRange(intrinsicCall.arguments[0]))
        replaceIntrinsicCall(declarator, "destructuringAlias")
        editor.insert(declarator.name.getStart(), `[${joinedDestructuringIds}]`, declaratorIdRange)
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
        if (ts.isClassDeclaration(firstDeclaration)) {
            if (debugMode) {
                editor.insert(
                    firstDeclaration.getStart(),
                    `let [${reactiveIdentifier}, ${name}] = ${defaultReactCallee}(`
                )
                editor.insert(firstDeclaration.getEnd(), `, ${generateHoistSetter(name)})`)
            } else {
                editor.insert(firstDeclaration.getEnd(), ")")
                editor.insert(firstDeclaration.getStart(), `let ${name} = ${defaultReactCallee}(`)
            }
            return
        }

        // TSEnumDeclaration
        if (ts.isEnumDeclaration(firstDeclaration)) {
            if (debugMode) {
                editor.insert(
                    firstDeclaration.getStart(),
                    `const [${reactiveIdentifier}] = ${defaultReactCallee}({}, ${generateSetterCode(
                        name
                    )})\n${inputDescriptor.indent}`
                )
            } else {
                editor.insert(
                    firstDeclaration.getStart(),
                    `const ${reactiveIdentifier} = ${defaultReactCallee}({})\n${inputDescriptor.indent}`
                )
            }
            for (const { declaration } of info.nodeInfos) {
                const writer = new RuntimeCodeWriter().indent()
                editor.insert(
                    declaration.getEnd(),
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
            const isFunctionDeclaration = ts.isFunctionDeclaration(firstDeclaration)
            if (!isFunctionDeclaration) {
                for (const nodeInfo of info.nodeInfos) {
                    const declarator = nodeInfo.declarator as ts.VariableDeclaration
                    const declaration = nodeInfo.declaration as ts.VariableDeclarationList
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
                        editor.insert(declarator.getEnd(), ";")
                    } else {
                        replaceCommaWithSemi(declarator)
                        editor.insert(
                            declaration.declarations[declaratorIndex + 1].getStart(),
                            "var "
                        )
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
                            declarator.getEnd(),
                            ` [${shouldUpdateTargetsArr.join(", ")}] = [${shouldUpdateItemsArr.join(", ")}];`
                        )
                    } else {
                        editor.insert(declarator.getEnd(), ` ${reactiveIdentifier}.$ = ${name};`)
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
        const declarator = info.nodeInfos[0].declarator as ts.VariableDeclaration
        const declaration = info.nodeInfos[0].declaration as ts.VariableDeclarationList
        const destructuringIdentifierNames = info.nodeInfos[0].destructuringIdentifierNames
        const isConst = getVariableDeclareKeyword(declaration) !== "let"
        if (!declarator.initializer) {
            if (!debugMode) {
                editor.insert(declarator.name.getEnd(), ` = ${defaultReactCallee}()`)
            } else {
                // assertion: non-const
                editor.insert(
                    declarator.name.getEnd(),
                    `] = ${defaultReactCallee}(${undefId}, ${generateHoistSetter(name)})`
                )
                editor.insert(declarator.name.getStart(), `[${reactiveIdentifier}, `)
            }
            return
        }

        if (!destructuringIdentifierNames) {
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
                    editor.insert(declarator.initializer.getEnd(), `, ${generateHoistSetter(name)}`)
                }
                editor.insert(declarator.initializer.getEnd(), ")")
                editor.insert(declarator.initializer.getStart(), `${internalId}.${reactFunc}(`)
            }
            return
        }

        if (processedItems.has(declarator)) {
            return
        }
        processedItems.add(declarator)

        const setterIds: string[] = []
        const needSetters = debugMode && !isConst
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
                declarator.name.getStart(),
                `[${destructuringIdentifierNames.join(", ")}] = ${internalId}.`
            )
        } else {
            const destructuringIds = destructuringIdentifierNames.map(item => {
                const { status } = analyzeResult.script.topLevelIdentifiers[item]
                const isReactive = status === "shallow" || status === "reactive"
                return isReactive ? `[${getReactiveIdentifier(item)}, ${item}]` : item
            })
            editor.insertMulti(declarator.name.getStart(), [
                {
                    value: `[${destructuringIds.join(", ")}]`,
                    sourceRange: getNodeRange(declarator.name)
                },
                {
                    value: ` = ${internalId}.`
                }
            ])
        }

        const intrinsicInfo = getIntrinsicInfo(declarator)
        editor.insert(
            declarator.name.getStart(),
            `destructuring${isShallow ? "Shallow" : ""}${isConst ? "Const" : ""}React`,
            intrinsicInfo && getNodeRange(intrinsicInfo.id)
        )
        editor.insert(declarator.name.getStart(), "((")
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
            editor.insert(
                declarator.getEnd(),
                `${needSetters ? `, [${setterIds.join(", ")}])` : ")"}`
            )
        }
        return
    }

    function replaceIntrinsicCall(
        declarator: ts.VariableDeclaration,
        newName: string,
        insertArg?: (hasArg: boolean) => string | undefined
    ) {
        const { call, id } = getIntrinsicInfo(declarator)!
        const initNodeStart = declarator.initializer!.getStart()
        const insertArgRet = insertArg?.(!!call.arguments.length)

        if ((processedItems.add(declarator), insertArgRet)) {
            if (call.arguments.length) {
                editor.insert(call.arguments[0].getEnd(), insertArgRet)
            } else {
                editor.insert(call.getEnd() - 1, insertArgRet)
            }
        }
        if (newName !== "") {
            editor.insert(id.getStart(), `${internalId}.`)
            editor.replace(id.getStart(), id.getEnd(), newName, true)
        } else {
            if (!call.arguments.length) {
                editor.remove(initNodeStart, call.getEnd() - 1)
            } else {
                editor.remove(call.arguments[0].getEnd(), call.getEnd() - 1)
                editor.remove(initNodeStart, call.arguments[0].getStart())
            }
            editor.remove(call.getEnd() - 1, call.getEnd())
        }
    }

    function replaceCommaWithSemi(declarator: ts.VariableDeclaration) {
        const declaratorEnd = declarator.getEnd()
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

    function transformNonDestructuringDeclaratorId(declarator: ts.VariableDeclaration) {
        if (debugMode) {
            const idNode = declarator.name as ts.Identifier
            editor.replace(
                idNode.getStart(),
                idNode.getEnd(),
                `[${getReactiveIdentifier(idNode.text)}, ${idNode.text}]`,
                true
            )
        }
    }

    function transformDestructuringEqualSign(
        declarator: ts.VariableDeclaration,
        returns: string[]
    ) {
        const [matchedIndex, matchedLen] = findOutOfComment(
            scriptSource.slice(declarator.name.getEnd()),
            jsDestructuringEqualTokenRE
        )
        const equalSignIndex = declarator.name.getEnd() + matchedIndex
        editor.replace(
            equalSignIndex,
            equalSignIndex + matchedLen,
            `) => [${returns.join(", ")}], `
        )
    }
}

function shouldNodeWrapAsGetter(node: ts.Node) {
    switch (getStriptTypeOperationsNode(node).kind) {
        case ts.SyntaxKind.ArrowFunction:
        case ts.SyntaxKind.FunctionExpression: {
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
    switch (firstDeclaration.kind) {
        case ts.SyntaxKind.ClassDeclaration: {
            return debugMode
        }
        case ts.SyntaxKind.EnumDeclaration:
        case ts.SyntaxKind.FunctionDeclaration: {
            return true
        }
        case ts.SyntaxKind.VariableDeclarationList: {
            const declarationList = firstDeclaration as ts.VariableDeclarationList
            switch (getVariableDeclareKeyword(declarationList)) {
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

function getIntrinsicInfo(declarator: ts.VariableDeclaration) {
    const id = analyzeResult.script.declaratorToIntrinsic.get(declarator)!
    if (id) {
        return {
            id,
            call: getStriptTypeOperationsParent(id) as ts.CallExpression
        }
    }
}

function findEndCommaIndexOfVariableDeclarator(declarator: ts.VariableDeclaration) {
    return findOutOfComment(inputDescriptor.script.code.slice(declarator.getEnd()), ",")
}
