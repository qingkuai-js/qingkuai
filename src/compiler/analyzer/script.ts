import type { NumNum } from "../../util/types"
import type { ASTLocation, ReplacementItem, ReplacementStatus } from "../types"
import type { Pattern, CallExpression, VariableDeclaration, Identifier } from "@babel/types"
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
    MixTwoSyntaxOfDerived,
    IdentifierMaybeOverwritten,
    RedundantArgsForCompilerFunc
} from "../message/warn"
import {
    reactCompilerFuncRE,
    watchCompilerFuncRE,
    bannedIdentifierFormatRE,
    scriptSourceIndentSpaceCount
} from "../regular"
import {
    parse,
    getEsNode,
    markExcludes,
    isInTopScope,
    getEsNodeOfParent,
    extendReplacement,
    initReplacementItem,
    functionMarkExcludes,
    getIdentifiersFromPattern
} from "../../util/compiler/estree"
import {
    BadExportRelatedStatement,
    WatchCompilerFuncMissingArg,
    ReactCompilerFuncNotInTopScope,
    IdentifierFormatIsNotAllowed,
    DestructureReactFuncWithNoArg,
    RegisterExsitingIdentifierName,
    ShortHandDerivedWithOtherReactFunc,
    ReactCompilerFuncWithoutVariableDeclaration
} from "../message/error"
import {
    getGeneratedScriptLine,
    getSourceLocByScriptLoc,
    getSourceIndexByScriptIndex
} from "../../util/compiler/locations"
import { walk } from "../estree/walk"
import { compilerFuncs } from "../constants"
import { lastElem } from "../../util/shared/sundry"
import { recordMappingWithNoOffset } from "../sourcemap"
import { findOutOfSC } from "../../util/compiler/strings"
import { getSetterIdentifier } from "../../util/compiler/sundry"
import { confirmQingKuaiIdentifierAliases, getAlias } from "./alias"
import { is, isFunctionNode, identifierIsReference } from "../estree/assert"

const visitor: ASTVisitor = {
    VariableDeclaration(node, parent) {
        analyzeReactivity(node, parent)
    },

    TSEnumDeclaration(node, parent) {
        if (isInTopScope(node, parent)) {
            checkTopScopeIdentifier(node.id.name, node.id.loc!)
        }
    },

    TSModuleDeclaration(node, parent) {
        if (is(node.id, "Identifier") && isInTopScope(node, parent)) {
            checkTopScopeIdentifier(node.id.name, node.id.loc!)
        }
    },

    FunctionDeclaration(node, parent) {
        if (node.id && isInTopScope(node, parent)) {
            checkTopScopeIdentifier(node.id.name, node.id.loc!)
        }
        functionMarkExcludes(node, parent.excludes)
    },

    ClassDeclaration(node, parent) {
        if (!node.id) {
            return
        }

        const name = node.id?.name
        const isDebug = inputDescriptor.options.debug
        const id = isDebug ? `[__w__${name}, ${name}]` : name

        const getReactFunc = () => {
            return getAlias("react")
        }

        const getSetterArg = () => {
            return isDebug ? ", " + getSetterIdentifier(name) : name
        }

        if (isInTopScope(node, parent)) {
            checkTopScopeIdentifier(name, node.id.loc!)
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
        const esParent = getEsNodeOfParent(parent)?.v
        const nodeSourceLoc = getSourceLocByScriptLoc(node.loc)

        if (
            is(callee, "Identifier") &&
            compilerFuncs.has(callee.name) &&
            !parent.excludes.has(callee.name)
        ) {
            if (watchCompilerFuncRE.test(callee.name)) {
                analyzeWatchCompilerFuncCall(node)
            } else if (reactCompilerFuncRE.test(callee.name)) {
                if (!isInTopScope(callee, parent)) {
                    ReactCompilerFuncNotInTopScope(nodeSourceLoc)
                }
                if (!is(esParent, "VariableDeclarator")) {
                    ReactCompilerFuncWithoutVariableDeclaration(nodeSourceLoc)
                }
            }
        }
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
            // 将其格式转换为 propertyName: (__w__)propertyName(.$)
            if (accessByDotDollar && is(esParent?.v, "ObjectProperty") && esParent.v.shorthand) {
                if (grand && is(getEsNodeOfParent(grand)!.v, "ObjectExpression")) {
                    replacementInfo.map.get(name)!.items.push(
                        initReplacementItem({
                            index: node.end,
                            text: `: ${isDebug ? "__w__" : ""}${name}.$`
                        })
                    )
                }
                return
            }

            if (accessByDotDollar) {
                if (isDebug) {
                    replacementItem.items.push(
                        initReplacementItem({
                            text: "__w__",
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

    ImportDeclaration(node, parent) {
        const { start, end } = node
        const scriptSource = inputDescriptor.script.code
        eliminateRanges.add([start, end])
        tempStoredImportInfos.push({
            mappingLine: [],
            startColumn: node.loc.start.column,
            code: scriptSource.slice(start, end)
        })
        if (isInTopScope(node, parent)) {
            node.specifiers.forEach(specifier => {
                checkTopScopeIdentifier(specifier.local.name, specifier.loc!)
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
    // 3. 当处于调试模式时，需要将变量声明关键字的结束位置添加到映射，因为标识符名称可能会添加__w__前缀
    AnyNode(node, parent) {
        if (
            is(node, "ExportAllDeclaration") ||
            is(node, "ExportDefaultDeclaration") ||
            is(node, "ExportNamedDeclaration")
        ) {
            BadExportRelatedStatement(node.loc)
        } else if (inputDescriptor.options.sourcemap) {
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
    let idRange: NumNum
    let initRange: NumNum
    let firstArgRange: NumNum

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

        const derTransParentheses = ["", ""]
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
                if (!isDestructuring) {
                    internalReactFunc = "derived"
                } else {
                    internalReactFunc = "destructuringDerived"
                }
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
                    index: initRange[1],
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
                        text: "[__w__"
                    }),
                    initReplacementItem({
                        index: idRange[1],
                        text: `, ${names[0]}]`
                    })
                )
            }

            // 非调试模式并且需要将初始值或参数值转换成函数时，需要判断返回值是否需要使用圆括号包裹
            if (derInitTransToFunc) {
                if (noInitOrNoArg) {
                    const equalToken = hasFnCall ? "" : " = "
                    const gsa = () => (isDebug ? getSetterArg() : "")
                    replacementItems.push(
                        initReplacementItem({
                            index: hasFnCall ? initRange[1] : idRange[1],
                            text: () => `${equalToken}${getReactFunc()}_ => void 0${gsa()})`
                        })
                    )
                } else if (scriptSource[valueRange[0]] === "{") {
                    ;[derTransParentheses[0], derTransParentheses[1]] = ["(", ")"]
                }
            }

            // 此时一定存在初始值($前缀便捷声明)或至少一个参数（der调用）
            if (!noInitOrNoArg) {
                if (isDestructuring) {
                    replacementItems.push(
                        initReplacementItem({
                            index: initRange[0],
                            text: () => {
                                return `${derInitTransToFunc ? "_ => " : ""}${
                                    derTransParentheses[0]
                                }`
                            }
                        })
                    )
                } else {
                    replacementItems.push(
                        initReplacementItem({
                            index: initRange[0],
                            text: () => {
                                const arrowFuncStr = derInitTransToFunc ? "_ => " : ""
                                return `${getReactFunc()}${arrowFuncStr}${derTransParentheses[0]}`
                            }
                        })
                    )
                    if (isDebug) {
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
        }

        // 处理非衍生响应性变量声明
        // 当变量声明语句需要转换为响应性声明时标记文本替换，这里需要区分是否解构语法
        // 调试模式时，为非const声明的标识符添加__w__前缀，并记录所有原始标识符名称，这些原始标识符
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
                            text: "[__w__"
                        }),
                        initReplacementItem({
                            index: idRange[1],
                            text: () => `, ${names[0]}]`
                        })
                    )
                }
                if (noInitOrNoArg) {
                    const equalToken = hasFnCall ? "" : " = "
                    replacementItems.push(
                        initReplacementItem({
                            index: hasFnCall ? initRange[1] : idRange[1],
                            text: () => `${equalToken}${getReactFunc()}void 0${getSetterArg()})`
                        })
                    )
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
            }
        }

        if (isDestructuring && reactFunc !== "stc") {
            const id = `[${destructuringIdentifierArr.join(", ")}]`
            const equalTokenIndex = findOutOfSC(scriptSource, "=", idRange[1])[0]
            const lengthArg = `, ${isDerived ? destructuringIdentifierArr.length : ""}`
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
                        text: `)${derTransParentheses[1]}`
                    })
                )
            }
            if (!isDebug) {
                markReplacementCommon(id)
                replacementItems.push(
                    initReplacementItem({
                        index: equalTokenIndex + 1,
                        text: `> ${id}${lengthArg}],`
                    })
                )
            } else {
                const ddIdentifierArr = destructuringIdentifierArr.map(item => {
                    return `[__w__${item}, ${item}]`
                })
                markReplacementCommon(`[${ddIdentifierArr.join(", ")}]`)
                replacementItems.push(
                    initReplacementItem({
                        index: equalTokenIndex + 1,
                        text: () => {
                            const setters = destructuringIdentifierArr.map(identifier => {
                                if (isConst && !isDerived) {
                                    return getAlias("noop")
                                } else {
                                    return getSetterIdentifier(identifier)
                                }
                            })
                            return `> ${id}${lengthArg}, ${setters.join(", ")}],`
                        }
                    })
                )
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

        // 断言为方法调用节点的init，使用前需确保hasFnCall为true
        const assertedCalleeInit = esInit as CallExpression

        const idTypeAnnotation = (id as Pattern).typeAnnotation
        const names = getIdentifiersFromPattern(id as EsPattern)
        const shortHandDerived = is(id, "Identifier") && id.name.startsWith("$")
        const esCallee = is(esInit, "CallExpression") ? getEsNode(esInit.callee) : null
        const esIdentifierCalleeName = is(esCallee, "Identifier") ? esCallee.name : ""
        const declarationSourceLoc = getSourceLocByScriptLoc(node.declarations[index].loc!)

        // 非顶部作用域声明
        if (!isInTopScope) {
            return names.forEach(name => {
                parent.parent?.excludes.add(name)
            })
        }

        // 去除类型注释
        if (idTypeAnnotation) {
            const { start, end } = idTypeAnnotation
            eliminateRanges.add([start!, end!])
        }

        // 状态标记
        hasInit = Boolean(init)
        idRange = [id.start!, id.end!]
        initRange = [initStart, initEnd]
        hasFnCall = reactCompilerFuncRE.test(esIdentifierCalleeName)
        reactFunc = hasFnCall ? esIdentifierCalleeName : ""
        hasFnArg = hasFnCall && assertedCalleeInit.arguments.length > 0
        isDerived = shortHandDerived || (hasFnCall && esIdentifierCalleeName === "der")

        // TODO: 可选择性关闭$前缀声明响应性状态

        // 检查是否混用了der和$前缀两种衍生响应性状态声明方式（警告）
        // 检查是否使用了$前缀搭配了其他响应性声明编译助手函数（rea、stc）（报错）
        if (inputDescriptor.options.convenientDerivedDeclaration && shortHandDerived && hasFnCall) {
            if (esIdentifierCalleeName === "der") {
                MixTwoSyntaxOfDerived(declarationSourceLoc)
            } else {
                ShortHandDerivedWithOtherReactFunc(esIdentifierCalleeName, declarationSourceLoc)
            }
        }

        // 标记是否解构声明语法，解构且未使用编译器助手函数时标记id开始的位置至init开始的位置无需映射
        if ((isDestructuring = is(id, "ObjectPattern") || is(id, "ArrayPattern"))) {
            destructuringIdentifierArr = getIdentifiersFromPattern(id)
            !hasFnCall && markSegmentShouldNotBeMapped(idRange[0], initRange[0])
        }

        // 检查是否是编译助手函数调用，是的话需要标记相关信息
        if (hasFnCall) {
            const cinit = init as CallExpression
            const [firstArg, secondArg] = cinit.arguments
            const [cs, ce] = [cinit.callee.start!, cinit.end!]
            if (hasFnArg) {
                const argLen = cinit.arguments.length
                const [_, se] = [secondArg?.start, secondArg?.end]
                const [fs, fe] = (firstArgRange = [firstArg.start!, firstArg.end!])

                // 以下是用于报错/警告的一些源码位置
                const sfe = getSourceIndexByScriptIndex(fe)
                const sse = getSourceIndexByScriptIndex(se!)
                const sle = getSourceIndexByScriptIndex(cinit.arguments[argLen - 1].end!)

                // 函数调用开始括号的索引
                // end index of callee start parentheses
                const ps = findOutOfSC(scriptSource, "(", init!.start!)[0] + 1

                // 解构时，将id的开始位置至第一个参数开始的位置标记为无需映射
                if (isDestructuring) {
                    markSegmentShouldNotBeMapped(idRange[0], fs)
                }

                switch (esIdentifierCalleeName) {
                    case "stc":
                        eliminateRanges.add([cs, ps])
                        eliminateRanges.add([fe, ce])
                        if (argLen > 1) {
                            RedundantArgsForCompilerFunc("stc", 1, sfe, sle)
                        }
                        break
                    case "rea":
                        eliminateRanges.add([cs, ps])
                        if (argLen > 2) {
                            eliminateRanges.add([se!, ce])
                            RedundantArgsForCompilerFunc("rea", 2, sse, sle)
                        } else {
                            eliminateRanges.add([ce - 1, ce])
                        }
                        break
                    case "der":
                        isDerived = true
                        eliminateRanges.add([cs, ps])
                        if (argLen > 1) {
                            eliminateRanges.add([fe, ce])
                            RedundantArgsForCompilerFunc("der", 1, sfe, sle)
                        } else {
                            eliminateRanges.add([ce - 1, ce])
                        }
                        break
                }
            } else {
                eliminateRanges.add(initRange)

                // 编译助手函数+解构声明且无参数时报错（其他情况如计算后的undefined、null等）会在运行时报错
                isDestructuring && DestructureReactFuncWithNoArg(reactFunc, declarationSourceLoc)
            }
        }

        // 衍生响应性状态声明时标记是否需要转换为函数（非函数节点都需要转换为函数）
        // 调试模式下的const衍生响应性状态声明要改用let关键字，因为setter中要修改调试标识符的值
        if (isDerived) {
            if (isDebug && isConst && index === 0) {
                useLetKeyword = true
                eliminateRanges.add([node.start, idRange[0]])
            }
            if (!hasFnCall) {
                derInitTransToFunc = !isFunctionNode(init)
            } else {
                derInitTransToFunc = !isFunctionNode(assertedCalleeInit.arguments[0])
            }
        }

        extend(names)
        names.forEach(name => checkTopScopeIdentifier(name, id.loc!))
    })
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

    if (compilerFuncs.has(name) || name === "props" || name === "refs") {
        RegisterExsitingIdentifierName(name, sourceLoc)
    }

    if (name === "$arg") {
        IdentifierMaybeOverwritten(name, sourceLoc)
    }
}

// 分析watch相关编译器助手函数调用，如果用户已经从qingkuai/runtime导入了watch相关方法，助手函数转换
// 后不会使用同名标识符，而是会从qingkuai/internal重新导入一份，由于两种导入方式实际都来自同一个chunk，
// 因此不会导致打包结果中存在重复代码，这样的好处是从编译结果中可以区分用户在源码中对watch相关方法的调用方式
function analyzeWatchCompilerFuncCall(node: CallExpression & RequiredPosition) {
    const transMap = new Map([
        ["waT", "watch"],
        ["Wat", "preWatch"],
        ["wat", "syncWatch"]
    ])
    const argsLen = node.arguments.length
    const calleeName = (node.callee as Identifier).name
    const emptyStringReplacement = replacementInfo.map.get("")!

    // 检查参数数量
    if (argsLen < 2) {
        WatchCompilerFuncMissingArg(calleeName, argsLen, node.loc)
    } else if (argsLen > 2) {
        RedundantArgsForCompilerFunc(calleeName, 2, node.arguments[1].end!, node.end - 1)
    }

    // 转换watch相关编译助手函数调用
    emptyStringReplacement.items.push(
        initReplacementItem({
            index: node.start,
            text: () => getAlias(transMap.get(calleeName)!)
        })
    )
    eliminateRanges.add([node.callee.start!, node.callee.end!])

    // 首个参数非函数节点时转换为getter
    if (argsLen > 0) {
        const firstArg = node.arguments[0]
        const [fs, fe] = [firstArg.start!, firstArg.end!]
        const wrwp = inputDescriptor.script.code[fs] === "{" // Wrap Return value With Parentheses
        if (!isFunctionNode(getEsNode(firstArg))) {
            emptyStringReplacement.items.push(
                initReplacementItem({
                    index: fs,
                    text: () => `_ => ${wrwp ? "(" : ""}`
                })
            )
            if (wrwp) {
                emptyStringReplacement.items.push(
                    initReplacementItem({
                        index: fe,
                        text: ")"
                    })
                )
            }
        }
    }
}
