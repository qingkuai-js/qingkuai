import type { FixedArray } from "../../util/types"
import type { ASTLocation, ReplacementItem, ReplacementStatus } from "../types"
import type { Pattern, CallExpression, VariableDeclaration } from "@babel/types"
import type { ASTVisitor, EsPattern, RequiredPosition, TraverseParent } from "../estree/types"

import {
    sourceMapInfo,
    replacementInfo,
    eliminateRanges,
    inputDescriptor,
    tempStoredImportInfos,
    allExistingIdentifiers
} from "../state"
import {
    RedundantArgs,
    DerLoseReactivity,
    MixTwoSyntaxOfDerived,
    IdentifierMaybeOverwritten
} from "../message/warn"
import {
    parse,
    getEsNode,
    markExcludes,
    getEsNodeOfParent,
    extendReplacement,
    initReplacementItem,
    functionMarkExcludes,
    getIdentifiersFromPattern
} from "../../util/compiler/estree"
import {
    CompilerFuncNotInTopScope,
    IdentifierFormatIsNotAllowed,
    DestructureReactFuncWithNoArg,
    RegisterExsitingIdentifierName,
    CompilerFuncWithoutVariableDeclaration
} from "../message/error"
import {
    getGeneratedScriptLine,
    getSourceLocByScriptLoc,
    getSourceIndexByScriptIndex
} from "../../util/compiler/locations"
import { walk } from "../estree/walk"
import { lastElem } from "../../util/shared/sundry"
import { recordMappingWithNoOffset } from "../sourcemap"
import { findOutOfSC } from "../../util/compiler/strings"
import { compilerFuncs, watchRelatedFuncs } from "../constants"
import { getSetterIdentifier } from "../../util/compiler/sundry"
import { confirmQingKuaiIdentifierAliases, getAlias } from "./alias"
import { is, isFunctionNode, identifierIsReference } from "../estree/assert"
import { bannedIdentifierFormatRE, scriptSourceIndentSpaceCount } from "../regular"

const visitor: ASTVisitor = {
    VariableDeclaration(node, parent) {
        analyzeReactivity(node, parent)
    },

    FunctionDeclaration(node, parent) {
        functionMarkExcludes(node, parent.excludes)
    },

    ClassDeclaration(node, parent) {
        const name = node.id!.name
        const isDebug = inputDescriptor.options.debug
        const id = isDebug ? `[_w_${name}, ${name}]` : name

        const getReactFunc = () => {
            return getAlias("react")
        }

        const getSetterArg = () => {
            return isDebug ? ", " + getSetterIdentifier(name) : name
        }

        if (is(parent.v, "Program") && name) {
            extendReplacement(name, false, true, [
                initReplacementItem({
                    index: node.start,
                    text: () => `let ${id} = ${getReactFunc()}(`
                }),
                initReplacementItem({
                    index: node.end,
                    text: () => `${getSetterArg()})`
                })
            ])
        }
        markExcludes(parent.excludes, getIdentifiersFromPattern(node.id))
    },

    CallExpression(node, parent) {
        const callee = getEsNode(node.callee)
        const esParent = getEsNodeOfParent(parent)
        const esGrand = getEsNodeOfParent(esParent?.parent)
        const esGreatGrand = getEsNodeOfParent(esGrand?.parent)
        const nodeSourceLoc = getSourceLocByScriptLoc(node.loc)
        if (is(callee, "Identifier")) {
            const funcName = callee.name
            const isExclude = parent.excludes.has(funcName)
            if (compilerFuncs.has(funcName) && !isExclude) {
                if (!is(esParent!.v, "VariableDeclarator")) {
                    CompilerFuncWithoutVariableDeclaration(nodeSourceLoc)
                }
                if (!is(esGreatGrand?.v, "Program")) {
                    if (!parent.excludes.has(funcName)) {
                        CompilerFuncNotInTopScope(nodeSourceLoc)
                    }
                }
            }
        }
        analyzeWatch(node, parent)
    },

    Identifier(node, parent) {
        const { name } = node
        const grand = parent.parent
        const esParent = getEsNodeOfParent(parent)
        const isDebug = inputDescriptor.options.debug
        const replacementItem = replacementInfo.map.get(name)
        const accessByDotDollar = replacementItem?.useDollar && !parent.excludes.has(name)

        // 检查是否是被禁止的标识符格式
        if (bannedIdentifierFormatRE.test(name)) {
            IdentifierFormatIsNotAllowed(name, getSourceLocByScriptLoc(node.loc))
        }

        // 记录所有的标识符，用于确定导入项和init解构标识符别名
        allExistingIdentifiers.add(name)

        // 需要通过.$访问的标识符
        if (identifierIsReference(node, parent)) {
            // ObjectProperty中的shorthand声明，
            // 将其格式转换为 propertyName: (_w_)propertyName(.$)
            if (accessByDotDollar && is(esParent?.v, "ObjectProperty") && esParent.v.shorthand) {
                if (grand && is(getEsNodeOfParent(grand)!.v, "ObjectExpression")) {
                    replacementInfo.map.get(name)!.items.push(
                        initReplacementItem({
                            index: node.end,
                            text: `: ${isDebug ? "_w_" : ""}${name}.$`
                        })
                    )
                }
                return
            }

            if (accessByDotDollar) {
                if (isDebug) {
                    replacementItem.items.push(
                        initReplacementItem({
                            text: "_w_",
                            index: node.start
                        })
                    )
                }
                replacementItem.items.push(
                    initReplacementItem({
                        order: 1,
                        text: ".$",
                        index: node.end
                    })
                )
            }
        }
    },

    ImportDeclaration(node) {
        const { start, end } = node
        const scriptSource = inputDescriptor.script.code
        const isQingKuaiRuntime = node.source.value === "qingkuai"
        eliminateRanges.add([start, end])
        node.specifiers.forEach(({ local: { name }, loc }) => {
            checkTopScopeIdentifier(name, loc!)
        })
        tempStoredImportInfos.push({
            mappingLine: [],
            startColumn: node.loc.start.column,
            code: scriptSource.slice(start, end)
        })

        // 标记watch相关的方法的导入名称或runtime命名空间导入名称
        // 在CallExpression捕获组中这用到这些标记信息对watch相关方法调用进行getter包装
        if (isQingKuaiRuntime) {
            node.specifiers.forEach(specifier => {
                if (is(specifier, "ImportSpecifier")) {
                    const { imported } = specifier
                    if (is(imported, "Identifier")) {
                        if (watchRelatedFuncs.has(imported.name)) {
                            inputDescriptor.script.runtime.watchIdentifiers.add(
                                specifier.local.name
                            )
                        }
                    }
                } else if (is(specifier, "ImportNamespaceSpecifier")) {
                    inputDescriptor.script.runtime.namespaceIdentifier = specifier.local.name
                }
            })
        }
    },

    FunctionExpression(node, parent) {
        functionMarkExcludes(node, parent.excludes)
    },

    ClassExpression(node, parent) {
        markExcludes(parent.excludes, getIdentifiersFromPattern(node.id))
    },

    // 任意节点都将被捕获进入，此捕获组主要用来记录sourcemap信息，具体分为下面几种情况：
    // 1. 非import语句（且不是Program）节点时，统一记录sourcemap信息
    // 2. import语句的sourcemap信息单独记录，因为import语句会被提升到生成代码的顶部
    // 3. 当处于调试模式时，需要将变量声明关键字的结束位置添加到映射，因为标识符名称可能会添加_w_前缀
    AnyNode(node, parent) {
        if (inputDescriptor.options.sourcemap) {
            if (
                is(node, "ImportDeclaration") ||
                is(parent.v, "ImportSpecifier") ||
                is(parent.v, "ImportDeclaration") ||
                is(parent.v, "ImportDefaultSpecifier")
            ) {
                const curInfo = lastElem(tempStoredImportInfos)
                const { startColumn, mappingLine } = curInfo
                const { line, column } = node.loc.start
                const generatedColumn = column - startColumn
                const sourceLine = getGeneratedScriptLine(line)
                mappingLine.push([generatedColumn, 0, sourceLine - 1, column])
            } else {
                if (!is(node, "Program")) {
                    recordMappingWithNoOffset(node.loc.start)
                    recordMappingWithNoOffset(node.loc.end)
                }
            }
        }
    }
}

export function analyzeScript(source: string) {
    // 确认源文件采用的缩进对应的空格数量
    const indentSpaceCount = scriptSourceIndentSpaceCount.exec(source)?.[1].length || 2
    inputDescriptor.indentSpaceCount = indentSpaceCount

    // 初始化replacement
    // 用来存储那些不需要依赖所属标识符项状态的替换项
    // 这里的items是一定要执行替换的，在replacement中它的键是空字符串
    replacementInfo.map.set("", {
        createSetter: false,
        useDollar: false,
        status: "rea",
        items: []
    })

    walk(parse(source), visitor)
    confirmQingKuaiIdentifierAliases()
}

// 分析reactivity相关编译助手函数调用
function analyzeReactivity(node: VariableDeclaration & RequiredPosition, parent: TraverseParent) {
    let reactFunc: string
    let idRange: FixedArray<number, 2>
    let initRange: FixedArray<number, 2>
    let firstArgRange: FixedArray<number, 2>

    let hasInit = false
    let hasFnArg = false
    let hasFnCall = false
    let isDerived = false
    let useLetKeyword = false
    let isDestructuring = false
    let derInitTransToFunc = false
    let destructuringIdentifierArr: string[] = []

    const isConst = node.kind === "const"
    const esParent = getEsNodeOfParent(parent)
    const isDebug = inputDescriptor.options.debug
    const isInTopScope = is(esParent!.v, "Program")
    const scriptSource = inputDescriptor.script.code

    const extend = (names: string[]) => {
        let arg = "("
        let useDollar = true
        let internalReactFunc = ""
        let status: ReplacementStatus = "pending"
        const createSetter = isDerived || !isConst
        const replacementItems: ReplacementItem[] = []
        const valueRange = hasFnCall ? firstArgRange : initRange
        const noInitOrNoArg = (hasFnCall && !hasFnArg) || (!hasFnCall && !hasInit)

        const getReactFunc = () => {
            return `${getAlias(internalReactFunc)}(`
        }

        if (isDerived || reactFunc === "rea") {
            status = "rea"
        }
        if (reactFunc === "stc") {
            status = "stc"
            useDollar = false
            internalReactFunc = ""
            arg = hasFnArg ? "" : "void 0"
        } else {
            if (isDerived) {
                internalReactFunc = "derived"
                useDollar = !isDestructuring
            } else {
                if (!hasFnArg) {
                    arg += "void 0"
                }
                if (!isConst) {
                    if (!isDestructuring) {
                        internalReactFunc = "react"
                    } else {
                        internalReactFunc = "destructuringReact"
                    }
                } else {
                    if (!isDestructuring) {
                        internalReactFunc = "constReact"
                    } else {
                        internalReactFunc = "constDestructuringReact"
                    }
                }
            }
        }

        // stc调用且未传递参数
        if (!internalReactFunc && !hasFnArg) {
            replacementItems.push(
                initReplacementItem({
                    index: initRange[0],
                    text: "void 0"
                })
            )
        }

        // 处理衍生响应性变量声明
        // 将$开头简便声明或der编译器助手函数转换为derived方法调用
        // 根据derInitTransToFunc判断是否要将init或der的参数转换为函数
        // 如果是解构声明语法需要在derived方法调用后添加.$以访问被包装的初始值
        if (isDerived) {
            const getSetterArg = () => {
                return `, ${getSetterIdentifier(names[0])}`
            }

            if (useLetKeyword) {
                useLetKeyword = false
                replacementItems.push(
                    initReplacementItem({
                        index: idRange[0],
                        text: "let "
                    })
                )
            }
            if (isDebug && !isDestructuring) {
                replacementItems.push(
                    initReplacementItem({
                        index: idRange[0],
                        text: "[_w_"
                    }),
                    initReplacementItem({
                        index: idRange[1],
                        text: `, ${names[0]}]`
                    })
                )
            }

            // rwp: whether Return value should be Wrapped with Parentheses
            // cwr: the Characters to Wrap Return value, useage: cwr[0] + <Return Value> + cwr[1]
            // 非调试模式并且需要将初始值或参数值转换成函数时，需要判断返回值是否需要使用圆括号包裹（判断规则就是返回时是否以{开头）
            // rwp 表示返回值是否需要使用括号包裹；cwr 表示括号字符，当rwp为true时，cwr就会被确定为["(", ")"]，否则是两个空字符串组成的数组
            let [rwp, cwr] = [false, ["", ""]]

            if (derInitTransToFunc) {
                if (!noInitOrNoArg) {
                    rwp = scriptSource[valueRange[0]] === "{"
                    rwp && (cwr = ["(", ")"])
                } else {
                    const equalToken = hasFnCall ? "" : " = "
                    const gsa = () => (isDebug ? getSetterArg() : "")
                    replacementItems.push(
                        initReplacementItem({
                            index: hasFnCall ? initRange[0] : idRange[1],
                            text: () => `${equalToken}${getReactFunc()}_ => void 0${gsa()})`
                        })
                    )
                }
            }

            // 此时一定存在初始值($前缀便捷声明)或至少一个参数（der调用）
            if (!noInitOrNoArg) {
                replacementItems.push(
                    initReplacementItem({
                        index: initRange[0],
                        text: () => {
                            const arrowFuncStr = derInitTransToFunc ? "_ => " : ""
                            return `${getReactFunc()}${arrowFuncStr}${cwr[0]}`
                        }
                    })
                )
                if (isDestructuring) {
                    replacementItems.push(
                        initReplacementItem({
                            index: initRange[1],
                            text: `${cwr[1]}).$`
                        })
                    )
                } else if (isDebug) {
                    replacementItems.push(
                        initReplacementItem({
                            index: valueRange[1],
                            text: () => `${getSetterArg()})`
                        })
                    )
                } else {
                    replacementItems.push(
                        initReplacementItem({
                            index: valueRange[1],
                            text: ")"
                        })
                    )
                }
            }
        }

        // 处理非衍生响应性变量声明
        // 当变量声明语句需要转换为响应性声明时标记文本替换，这里需要区分是否解构语法
        // 调试模式时，为非const声明的标识符添加_w_前缀，并记录所有原始标识符名称，这些原始标识符
        // 名称会在生成代码的底部被声明，并由响应性声明方法接受的setter参数进行赋值
        if (!isDerived && internalReactFunc) {
            if (!isDestructuring) {
                const getSetterArg = (ret = "") => {
                    if (isDebug) {
                        if (isConst) {
                            ret = getAlias("noop")
                        } else {
                            ret = getSetterIdentifier(names[0])
                        }
                    }
                    return ret ? ", " + ret : ret
                }

                if (isDebug) {
                    replacementItems.push(
                        initReplacementItem({
                            index: idRange[0],
                            text: "[_w_"
                        }),
                        initReplacementItem({
                            index: idRange[1],
                            text: () => `, ${names[0]}]`
                        })
                    )
                }
                if (noInitOrNoArg) {
                    const equalToken = hasFnCall ? "" : " = "
                    if (isDebug && !isConst) {
                        replacementItems.push(
                            initReplacementItem({
                                index: hasFnCall ? initRange[0] : idRange[1],
                                text: () => `${equalToken}${getReactFunc()}void 0${getSetterArg()})`
                            })
                        )
                    }
                } else {
                    replacementItems.push(
                        initReplacementItem({
                            index: initRange[0],
                            text: () => getReactFunc()
                        })
                    )
                    if (isDebug) {
                        replacementItems.push(
                            initReplacementItem({
                                index: valueRange[1],
                                text: () => getSetterArg()
                            })
                        )
                    }
                    replacementItems.push(
                        initReplacementItem({
                            index: initRange[1],
                            text: ")"
                        })
                    )
                }
            } else {
                const id = `[${destructuringIdentifierArr.join(", ")}]`
                const equalTokenIndex = findOutOfSC(scriptSource, "=", idRange[1])[0]
                const markReplacementCommon = (idStr: string) => {
                    replacementItems.push(
                        initReplacementItem({
                            index: idRange[0],
                            text: () => `${idStr} = ${getReactFunc()}[(`
                        }),
                        initReplacementItem({
                            index: idRange[1],
                            text: ")"
                        }),
                        initReplacementItem({
                            index: initRange[1],
                            text: ")"
                        })
                    )
                }
                if (!isDebug) {
                    markReplacementCommon(id)
                    replacementItems.push(
                        initReplacementItem({
                            index: equalTokenIndex + 1,
                            text: `> ${id}],`
                        })
                    )
                } else {
                    const ddIdentifierArr = destructuringIdentifierArr.map(item => {
                        return `[_w_${item}, ${item}]`
                    })
                    markReplacementCommon(`[${ddIdentifierArr.join(", ")}]`)
                    replacementItems.push(
                        initReplacementItem({
                            index: equalTokenIndex + 1,
                            text: () => {
                                const setters = destructuringIdentifierArr.map(identifier => {
                                    if (isConst) {
                                        return getAlias("noop")
                                    } else {
                                        return getSetterIdentifier(identifier)
                                    }
                                })
                                return `> ${id}, ${setters.join(", ")}],`
                            }
                        })
                    )
                }
            }
        }

        if (replacementItems.length) {
            extendReplacement(names, useDollar, createSetter, replacementItems, status)
        }
    }

    node.declarations.forEach(({ id, init, end }, index) => {
        let initEnd = init?.end ?? end!
        let initStart = init?.start ?? end!

        const esInit = init ? getEsNode(init) : init
        const idTypeAnnotation = (id as Pattern).typeAnnotation
        const names = getIdentifiersFromPattern(id as EsPattern)
        const esInitIsIdentifierCallee = (hasFnCall = is(esInit, "CallExpression"))
        const esCallee = esInitIsIdentifierCallee ? getEsNode(esInit.callee) : null
        const calleeName = is(esCallee, "Identifier") ? esCallee.name : ""
        const declarationSourceLoc = getSourceLocByScriptLoc(node.declarations[index].loc!)

        // 非顶部作用域声明
        if (!isInTopScope) {
            names.forEach(name => {
                parent.parent?.excludes.add(name)
            })
            return
        }

        // 去除类型注释
        if (idTypeAnnotation) {
            const { start, end } = idTypeAnnotation
            eliminateRanges.add([start!, end!])
        }

        // 状态标记
        reactFunc = ""
        hasInit = Boolean(init)
        idRange = [id.start!, id.end!]
        initRange = [initStart, initEnd]
        if (esInitIsIdentifierCallee) {
            hasFnCall = compilerFuncs.has(calleeName)
            if (hasFnCall) {
                reactFunc = calleeName
                hasFnArg = esInit.arguments.length > 0
            }
        }

        // 标记是否解构声明语法，非解构声明时检查是否衍生响应性状态（使用$前缀）
        if (is(id, "ObjectPattern") || is(id, "ArrayPattern")) {
            isDestructuring = true
            markSegmentShouldNotBeMapped(idRange[0], idRange[1] + 1)
            destructuringIdentifierArr = getIdentifiersFromPattern(id)
        } else if (is(id, "Identifier")) {
            isDerived = id.name.startsWith("$")
            if (isDerived) {
                if (esInitIsIdentifierCallee && calleeName === "der") {
                    MixTwoSyntaxOfDerived(declarationSourceLoc)
                }
            }
        }

        // 检查是否是编译助手函数调用，是的话需要标记相关信息
        if (hasFnCall) {
            const cinit = init as CallExpression
            const [firstArg, secondArg] = cinit.arguments
            const [cs, ce] = [cinit.callee.start!, cinit.end!]
            if (hasFnArg) {
                const argLen = cinit.arguments.length
                const [_, se] = [secondArg?.start, secondArg?.end]
                const [__, fe] = (firstArgRange = [firstArg.start!, firstArg.end!])

                // 以下是用于报错/警告的一些源码位置
                const sfe = getSourceIndexByScriptIndex(fe)
                const sse = getSourceIndexByScriptIndex(se!)
                const sle = getSourceIndexByScriptIndex(cinit.arguments[argLen - 1].end!)

                // 函数调用开始括号的索引
                // end index of callee start parentheses
                const ps = findOutOfSC(scriptSource, "(", init!.start!)[0] + 1

                switch (calleeName) {
                    case "stc":
                        eliminateRanges.add([cs, ps])
                        eliminateRanges.add([fe, ce])
                        if (argLen > 1) {
                            RedundantArgs("stc", 1, sfe, sle)
                        }
                        break
                    case "rea":
                        eliminateRanges.add([cs, ps])
                        if (argLen > 2) {
                            eliminateRanges.add([se!, ce])
                            RedundantArgs("rea", 2, sse, sle)
                        } else {
                            eliminateRanges.add([ce - 1, ce])
                        }
                        break
                    case "der":
                        isDerived = true
                        eliminateRanges.add([cs, ps])
                        if (argLen > 1) {
                            eliminateRanges.add([fe, ce])
                            RedundantArgs("der", 1, sfe, sle)
                        } else {
                            eliminateRanges.add([ce - 1, ce])
                        }
                        break
                }
            } else {
                reactFunc = calleeName
                eliminateRanges.add(initRange)
                isDerived = reactFunc === "der"
                if (isDestructuring) {
                    DestructureReactFuncWithNoArg(reactFunc, declarationSourceLoc)
                }
            }
        }

        // 衍生响应性状态声明时标记是否需要转换为函数
        // 调试模式下的const衍生响应性状态声明要改用let关键字，因为setter中要修改调试标识符的值
        if (isDerived) {
            if (isDestructuring) {
                DerLoseReactivity(declarationSourceLoc)
            } else if (isDebug && isConst && index === 0) {
                useLetKeyword = true
                eliminateRanges.add([node.start, idRange[0]])
            }
            if (!esInitIsIdentifierCallee) {
                derInitTransToFunc = !isFunctionNode(init)
            } else {
                derInitTransToFunc = !isFunctionNode(esInit.arguments[0])
            }
            if (derInitTransToFunc) {
                markSegmentShouldNotBeMapped(initRange[0], initRange[1] + 1)
            }
        }

        extend(names)
        names.forEach(name => checkTopScopeIdentifier(name, id.loc!))
    })
}

// 分析watch相关运行时方法调用
function analyzeWatch(node: CallExpression & RequiredPosition, parent: TraverseParent) {
    const { callee } = node
    const firstArg = node.arguments[0]
    const scriptSource = inputDescriptor.script.code
    const emptyStringReplacement = replacementInfo.map.get("")!
    const retUseParentheses = scriptSource[firstArg?.start || 0] === "{"
    const { namespaceIdentifier, watchIdentifiers } = inputDescriptor.script.runtime

    if (node.arguments.length === 0) {
        return
    }

    // prettier-ignore
    if (
        (
            is(callee, "Identifier") &&
            !parent.excludes.has(callee.name) &&
            watchIdentifiers.has(callee.name)
        ) ||
        (
            is(callee, "MemberExpression") &&
            is(callee.object, "Identifier") &&
            is(callee.property, "Identifier") &&
            !parent.excludes.has(callee.object.name) &&
            callee.object.name === namespaceIdentifier &&
            watchRelatedFuncs.has(callee.property.name)
        )
    ) {
        emptyStringReplacement.items.push(
            initReplacementItem({
                index: firstArg.start!,
                text: `_ => ${retUseParentheses ? "(" : ""}`
            })
        )
        if (retUseParentheses) {
            emptyStringReplacement.items.push(
                initReplacementItem({
                    index: firstArg.end!,
                    text: ")"
                })
            )
        }
    }
}

// 标记某个片段不需要被映射
function markSegmentShouldNotBeMapped(start: number, end: number) {
    if (inputDescriptor.options.debug) {
        for (let i = start; i < end; i++) {
            sourceMapInfo.positionShouldNotBeMapped[i] = true
        }
    }
}

// 检查script部分顶部作用域中的标识符是否合法：
// 1. rea、stc、der及props是保留标识符名称，在顶部作用域中不能重复声明（报错）
// 2. 在内联事件中$event（非组件）和$param(组件)会覆盖顶部作用域中的同名标识符（警告）
function checkTopScopeIdentifier(name: string, loc: ASTLocation) {
    const sourceLoc = getSourceLocByScriptLoc(loc)

    if (compilerFuncs.has(name) || name === "props") {
        RegisterExsitingIdentifierName(name, sourceLoc)
    }

    if (name === "$event" || name === "$param") {
        IdentifierMaybeOverwritten(name, sourceLoc)
    }
}
