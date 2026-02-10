import type { IntrinsicCall } from "#type-declarations/estree"
import type { TopLevelIdentifierInfo } from "#type-declarations/compiler"
import type { VariableDeclaration, VariableDeclarator } from "@babel/types"

import {
    generateSetterCode,
    ensureIdWithPrefix,
    ensureIdWithNumSuffix
} from "../../../util/compiler/sundry"
import { CodeWriter } from "../writer"
import { CodeEditor } from "../editor"
import { jsDestructuringEqualTokenRE } from "../../regular"
import { analyzeResult, inputDescriptor } from "../../state"
import { findOutOfComment } from "../../../util/compiler/string"
import { newCleanObj, traverseObject } from "../../../util/shared/sundry"
import { arrayFrom } from "../../../util/shared/arrays"

export function getScriptTransformInfo(writer: CodeWriter, editor: CodeEditor) {
    let hoistSettersCount = 0

    const hoistWriter = new CodeWriter()
    const extractWriter = new CodeWriter()
    const internalId = analyzeResult.generateIds.internal
    const { declaratorToIntrinsic } = analyzeResult.script
    const processedDeclarators = new Set<VariableDeclarator>()
    const identifierMap: Record<string, string> = newCleanObj()
    const [undefId, noopId] = [`${internalId}.UNDEF`, `${internalId}.NOOP`]
    const varDeclarationToUpdateItems = new Map<VariableDeclaration, Set<string>>()

    traverseObject(analyzeResult.script.topLevelIdentifiers, (key, value) => {
        switch (value.status) {
            case "raw":
            case "literal": {
                transformRawDecalration(value)
                break
            }
            case "alias": {
                transformAliasDeclaration(key, value)
                break
            }
            case "shallow":
            case "reactive": {
                transformReactiveDeclaration(key, value)
                break
            }
        }
    })

    // 在 var 声明结束处插入响应式更新语句
    // Insert reactive update statements at the end of the `var` declaration.
    for (const [declaration, shouldUpdateItems] of varDeclarationToUpdateItems) {
        if (shouldUpdateItems.size) {
            const writer = new CodeWriter().indent()
            const shouldUpdateItemsArr = arrayFrom(shouldUpdateItems)
            if (shouldUpdateItemsArr.length === 1) {
                const item = shouldUpdateItemsArr[0]
                writer.write(`${getReactiveIdentifier(item)}.$ = ${item}`)
            } else {
                const updateTargets = shouldUpdateItemsArr.map(item => {
                    return `${getReactiveIdentifier(item)}.$`
                })
                writer.write(
                    `;[${updateTargets.join(", ")}] = [${shouldUpdateItemsArr.join(", ")}]`
                )
            }
            editor.insert(declaration.end!, writer.code)
        }
    }

    return {
        identifierMap,
        hoistContent: hoistWriter.empty ? "" : hoistWriter.wrapLine().code,
        extractContent: extractWriter.empty ? "" : extractWriter.wrapLine().code
    }

    function transformRawDecalration(info: TopLevelIdentifierInfo) {
        for (const { declarator } of info.nodeInfos) {
            if (
                declarator.type === "VariableDeclarator" &&
                declaratorToIntrinsic.has(declarator) &&
                !processedDeclarators.has(declarator)
            ) {
                removeIntrinsicCallWithDeclarator(declarator, true)
            }
        }
    }

    function transformAliasDeclaration(name: string, info: TopLevelIdentifierInfo) {
        
    }

    function transformReactiveDeclaration(name: string, info: TopLevelIdentifierInfo) {
        const isShallow = info.status === "shallow"
        const debugMode = inputDescriptor.options.debug
        const reactiveIdentifier = getReactiveIdentifier(name)
        const firstDeclaration = info.nodeInfos[0].declaration

        let reactFunc = `${internalId}.${isShallow ? "shallowReact" : "react"}`

        // TSEnumDeclaration
        if (firstDeclaration.type === "TSEnumDeclaration") {
            const writer = new CodeWriter().indent(false)
            writer.write(`let [${reactiveIdentifier}] = ${reactFunc}(`).indent().write("{},")
            writer.wrapLine().write(generateSetterCode(name)).dedent().write(")").wrapLine()
            editor.insert(info.nodeInfos[0].declaration.start!, writer.code)

            for (const { declaration } of info.nodeInfos) {
                const writer = new CodeWriter().indent()
                editor.insert(
                    declaration.end!,
                    writer.write(
                        isShallow
                            ? `${reactiveIdentifier}.$ = ${name}`
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
                    if (
                        !processedDeclarators.has(declarator) &&
                        declaratorToIntrinsic.has(declarator)
                    ) {
                        removeIntrinsicCallWithDeclarator(declarator, true)
                    }

                    // 记录需要在 var 声明语句结束处插入响应式更新语句的更新目标列表
                    // Record the list of update targets that require reactive update statements to be inserted at the end of the `var` declaration.
                    let shouldUpdateNames = varDeclarationToUpdateItems.get(declaration)
                    if (!shouldUpdateNames) {
                        varDeclarationToUpdateItems.set(
                            declaration,
                            (shouldUpdateNames = new Set())
                        )
                    }
                    if (!nodeInfo.destructuringIdentifierNames) {
                        shouldUpdateNames.add(name)
                    } else {
                        for (const item of nodeInfo.destructuringIdentifierNames) {
                            const status = analyzeResult.script.topLevelIdentifiers[item].status
                            if (status === "reactive" || status === "shallow") {
                                shouldUpdateNames.add(item)
                            }
                        }
                    }
                }
            }

            const reactiveTarget = isFunctionDeclaration ? name : undefId
            if (isFunctionDeclaration && debugMode) {
                hoistWriter.write(`let [${reactiveIdentifier}] = ${reactFunc}(`)
                hoistWriter.write(`${reactiveTarget}, ${generateSetterCode(name)})\n`)
            } else {
                hoistWriter.write(`let ${reactiveIdentifier} = ${reactFunc}(${reactiveTarget})\n`)
            }
            return
        }

        // ClassDeclaration
        if (firstDeclaration.type === "ClassDeclaration") {
            if (debugMode) {
                editor.insert(
                    firstDeclaration.start!,
                    `let [${reactiveIdentifier}, ${name}] = ${reactFunc}(`
                )
                editor.insert(firstDeclaration.end!, `, ${generateHoistSetter(name)})`)
            } else {
                editor.insert(firstDeclaration.end!, ")")
                editor.insert(firstDeclaration.start!, `let ${name} = ${reactFunc}(`)
            }
            return
        }

        // VariableDeclaration(non-var)
        const declarator = info.nodeInfos[0].declarator as VariableDeclarator
        const isConst = (firstDeclaration as VariableDeclaration).kind !== "let"
        if (!declarator.init) {
            if (!debugMode) {
                editor.insert(declarator.id.end!, ` = ${reactFunc}()`)
            } else {
                editor.insert(
                    declarator.id.end!,
                    `] = ${reactFunc}(${undefId}, ${generateHoistSetter(name)})`
                )
                editor.insert(declarator.id.start!, `[${reactiveIdentifier}, `)
            }
            return
        }

        if (!info.destructuringIdentifierNames) {
            if (isConst) {
                reactFunc = `${internalId}.${isShallow ? "shallowConstReact" : "constReact"}`
            }
            if (debugMode) {
                editor.insert(declarator.id.end!, "]")
                editor.insert(declarator.id.start!, `[${reactiveIdentifier}, `)
            }
            if (info.implicit) {
                if (debugMode) {
                    if (isConst) {
                        editor.insert(declarator.init.end!, `, ${noopId})`)
                    } else {
                        editor.insert(declarator.init.end!, `, ${generateHoistSetter(name)})`)
                    }
                }
                editor.insert(declarator.init.start!, reactFunc + "(")
            } else {
                const { call: intrinsicCall, id: intrinsicId } = getIntrinsicInfo(declarator)
                if (intrinsicCall.arguments.length) {
                    editor.insert(
                        intrinsicCall.end!,
                        `, ${isConst ? noopId : generateHoistSetter(name)})`
                    )
                    editor.remove(intrinsicCall.arguments[0].end!, intrinsicCall.end!)
                } else if (debugMode) {
                    editor.insert(
                        intrinsicCall.end!,
                        `(${undefId}, ${isConst ? `${noopId})` : generateHoistSetter(name)})`
                    )
                    editor.remove(intrinsicId.end!, intrinsicCall.end!)
                }
                editor.replace(...intrinsicId.range!, reactFunc)
            }
            return
        }

        // 同一解构声明的多个标识符只需处理一次
        // Multiple identifiers from the same destructuring declaration only need to be processed once.
        if (processedDeclarators.has(declarator)) {
            return
        } else {
            processedDeclarators.add(declarator)
        }

        const setterIds: string[] = []
        const { destructuringIdentifierNames } = info
        const destructuringFuncReturnItems = destructuringIdentifierNames.map((item, index) => {
            const { status } = analyzeResult.script.topLevelIdentifiers[item]
            const isReactive = status === "shallow" || status === "reactive"
            if (debugMode) {
                if (isReactive || index !== destructuringIdentifierNames.length - 1) {
                    setterIds.push(isReactive ? generateHoistSetter(item) : "")
                }
            }
            return `[${item}, ${+isReactive}]`
        })
        reactFunc = `${internalId}.destructuring${isShallow ? "Shallow" : ""}${isConst ? "Const" : ""}React`

        // Declaration id
        if (!debugMode) {
            editor.insert(
                declarator.id.start!,
                `[${destructuringIdentifierNames.join(", ")}] = ${reactFunc}((`
            )
        } else {
            const destructuringIds = destructuringIdentifierNames.map(item => {
                const { status } = analyzeResult.script.topLevelIdentifiers[item]
                const isReactive = status === "shallow" || status === "reactive"
                return isReactive ? `[${getReactiveIdentifier(item)}, ${item}]` : item
            })
            editor.insert(declarator.id.start!, `[${destructuringIds.join(", ")}] = ${reactFunc}((`)
        }

        // Destructuring func
        const [equalSignIndex, matchedLen] = findOutOfComment(
            inputDescriptor.script.code.slice(declarator.id.end!),
            jsDestructuringEqualTokenRE
        )
        editor.replace(
            declarator.id.end! + equalSignIndex,
            declarator.id.end! + equalSignIndex + matchedLen,
            `) => [${destructuringFuncReturnItems.join(", ")}], `
        )

        // Reactive target and debugging setters
        if (!info.implicit) {
            const { call: intrinsicCall } = getIntrinsicInfo(declarator)
            if (intrinsicCall.arguments.length) {
                editor.remove(intrinsicCall.arguments[0].end!, declarator.end!)
                editor.remove(declarator.init.start!, intrinsicCall.arguments[0].start!)
            } else {
                editor.insert(
                    declarator.end!,
                    `${undefId}${debugMode ? `, [${setterIds.join(", ")}])` : ")"}`
                )
                editor.remove(...intrinsicCall.range!)
            }
        } else {
            editor.insert(declarator.end!, `${debugMode ? `, [${setterIds.join(", ")}])` : ")"}`)
        }
        return
    }

    function removeIntrinsicCallWithDeclarator(declarator: VariableDeclarator, needValue = false) {
        const { call: intrinsicCall } = getIntrinsicInfo(declarator)
        if (!intrinsicCall.arguments.length) {
            if (!needValue) {
                editor.remove(...intrinsicCall.range!)
            } else {
                editor.replace(...intrinsicCall.range!, undefId)
            }
        } else {
            editor.remove(intrinsicCall.arguments[0].end!, intrinsicCall.end!)
            editor.remove(intrinsicCall.start!, intrinsicCall.arguments[0].start!)
        }
        processedDeclarators.add(declarator)
    }

    function getReactiveIdentifier(name: string) {
        return (identifierMap[name] ??= ensureIdWithPrefix("_" + name))
    }

    function generateHoistSetter(target: string) {
        const setterId = ensureIdWithNumSuffix("_S", ++hoistSettersCount)
        return (hoistWriter.write(`const ${setterId} = ${generateSetterCode(target)}\n`), setterId)
    }
}

function getIntrinsicInfo(declarator: VariableDeclarator) {
    const context = analyzeResult.script.declaratorToIntrinsic.get(declarator)!
    return {
        context: context,
        id: context.value,
        call: context.parent!.value as IntrinsicCall
    }
}
