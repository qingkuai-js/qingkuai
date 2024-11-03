import type {
    EliminateRanges,
    TemplateContext,
    StringOrStringGetter,
    TransformInterpolationRet,
    TransformInterpolationOptionalParam
} from "../types"
import type { AnyNode } from "../estree/types"
import type { FixedArray } from "../../util/types"
import type { GeneralFunc } from "../../util/types"

import {
    BadValueForRefAttr,
    InterpolationExpOutOfLimit,
    ContextIdentifierUsedAsReferenceTarget,
    SequenceExpreesionInInterpolationBlock
} from "../message/error"
import { walk } from "../estree/walk"
import { getAlias } from "../analyzer/alias"
import { runAll } from "../../util/shared/sundry"
import { is, isFunctionNode } from "../estree/assert"
import { stringify } from "../../util/compiler/strings"
import { identifierIsReference } from "../estree/assert"
import { expressionReplaceWithSpaceRE } from "../regular"
import { getLocByIndex } from "../../util/compiler/locations"
import { isEmptyString, isFunction, isUndefined } from "../../util/shared/assert"
import { getEsNode, getEsNodeOfParent, parse } from "../../util/compiler/estree"
import { inputDescriptor, replacementInfo, allExistingIdentifiers } from "../state"
import { checkIdentifierName, confirmAlias, isIndexEliminated } from "../../util/compiler/sundry"

export function transformInterpolation(
    expression: string,
    startSourceIndex: number,
    context: TemplateContext,
    type: "directive" | "attribute" | "event" | "content",
    optionalParams: TransformInterpolationOptionalParam = {}
): TransformInterpolationRet {
    if (isEmptyString(expression)) {
        return ""
    }

    const bodyAst = parse("_=" + expression)?.body
    const endSourceIndex = startSourceIndex + expression.length

    if (bodyAst!.length > 1) {
        return InterpolationExpOutOfLimit(startSourceIndex, endSourceIndex), ""
    }

    const expressionAst = (bodyAst as any)[0].expression
    if (is(expressionAst, "SequenceExpression")) {
        return SequenceExpreesionInInterpolationBlock(startSourceIndex, endSourceIndex), ""
    }

    // 检查模式下语法检查完成后无需执行后续的转换操作
    if (inputDescriptor.options.check) {
        return expression
    }

    let vParam = "v"
    let ctxParam = "ctx"
    let useGetter = false
    let useContext = false
    let underlineParam = "_"
    let firstMappingOffsetLeft = 0

    const indexMap: number[] = []
    const transformedArr: string[] = []
    const sourcemapIndexes: number[] = []
    const afterWalkFuncs: GeneralFunc[] = []
    const mappings: FixedArray<number, 4>[] = []
    const contextVariables: [string, number][] = []
    const expEliminateRanges: EliminateRanges = new Set()
    const allIndentifiersInExpression = new Set<string>()
    const transformInfos: Map<number, StringOrStringGetter[]> = new Map()

    const ast = expressionAst.right
    const isDebug = inputDescriptor.options.debug
    const eventWrapper = optionalParams.eventWrapper
    const usedAsSetter = optionalParams.usedAsSetter || false
    const noPositionMap = isUndefined(optionalParams.positionMap)
    const isKeyDirective = optionalParams.isKeyDirective || false
    const shouldGenerateSourcemap = inputDescriptor.options.sourcemap
    const isEvent = optionalParams.isComponentEvent || !isUndefined(eventWrapper)

    // 扩展转换信息数组
    const extendTransformInfo = (index: number, str: StringOrStringGetter) => {
        const item = transformInfos.get(index - 2)
        if (item) {
            item.push(str)
        } else {
            transformInfos.set(index - 2, [str])
        }
    }

    // 当转换后的表达式要用作setter时，它必须是可赋值的（左值）
    // 注意：目前只有引用属性会将optionalParams.usedAsSetter设置为true，所以这里的报错方法就是引用属性相关的，
    // 如果后续其他地方也需要用到setter模式的转换，可以考虑传入不同的报错方法提前解析表达式等方案完善这里的兼容性
    if (optionalParams.usedAsSetter && !(is(ast, "Identifier") || is(ast, "MemberExpression"))) {
        const expressionEndSourceIndex = startSourceIndex + expression.length
        BadValueForRefAttr(expression, getLocByIndex(startSourceIndex, expressionEndSourceIndex))
    }

    walk(ast, {
        Identifier(node, parent) {
            const { name, start, end } = node
            const nodeEndSourceIndex = startSourceIndex + end - 2
            const nodeStartSourceIndex = startSourceIndex + start - 2
            const nodeLoc = getLocByIndex(nodeStartSourceIndex, nodeEndSourceIndex)

            allExistingIdentifiers.add(name)
            allIndentifiersInExpression.add(name)

            // 检查插值表达式中是否使用了禁止使用的标识符
            checkIdentifierName(node.name, nodeLoc, false)

            if (!identifierIsReference(node, parent)) {
                return
            }

            const ctx = context.map.get(name)
            const dep = replacementInfo.map.get(name)
            const esParent = getEsNodeOfParent(parent)

            // 如果表达式访问了props或refs，就要使用getter包装
            if (!dep && /^(?:prop|ref)s$/.test(name)) {
                useGetter = true
                return
            }

            // 处理ObjectProperty中的shrothand声明
            // 将其格式转换为 propertyName: (_w_)propertyName(.$)
            if (is(esParent?.v, "ObjectProperty") && esParent.v.shorthand) {
                extendTransformInfo(start, `${name}: `)
            }

            if (ctx) {
                if (isDebug && !usedAsSetter && type !== "directive") {
                    contextVariables.push([name, ctx.num])
                } else {
                    if (!isKeyDirective) {
                        extendTransformInfo(end, () => {
                            return `${ctxParam}(${ctx.num})`
                        })
                    } else {
                        extendTransformInfo(end, () => {
                            return `${ctxParam}(${ctx.num})${ctx.path}`
                        })
                    }
                    expEliminateRanges.add([start, end])
                }
                useGetter = useContext = true
            } else if (dep) {
                dep.status = "rea"
                if (dep.useDollar) {
                    useGetter = true
                    extendTransformInfo(end, ".$")
                    if (isDebug) {
                        extendTransformInfo(start, "_w_")
                    }
                }
            }
        },
        CallExpression(node) {
            useGetter = true
            if (isEvent) {
                const callee = node.callee
                useContext = true
                extendTransformInfo(callee.start!, () => `${ctxParam}(`)
                afterWalkFuncs.push(() => {
                    extendTransformInfo(callee.end!, ")")
                })
            }
        },
        StringLiteral(node) {
            expEliminateRanges.add([node.start, node.end])
            extendTransformInfo(node.end, stringify(node.value))
        },
        TemplateElement(node) {
            expEliminateRanges.add([node.start, node.end])
            extendTransformInfo(node.end, `$\{${stringify(node.value.raw)}}`)
        },

        // 标记需要记录sourcemap信息的索引（表达式转换前的索引）转换完成后，可以通过访问
        // indexMap[转换前的索引]来换取它对应的转换后的表达式位置索引
        AnyNode(node) {
            if (startSourceIndex !== -1) {
                sourcemapIndexes.push(node.start - 2, node.end - 2)
            }
        }
    })

    // walk结束后执行的方法：有些转换的顺序不一定与walk遍历时相同，例如需要调用ctx
    // 以绑定当前节点的CallExpression转换信息就需要在Identifier捕获组之后被添加，
    // 这种情况在walk中Identifer捕获组先于CallExpression
    runAll(afterWalkFuncs)

    // 如果当前表达式未使用getter包装，则判断其本身是否有可能是函数，如果有可能的话，
    // 需要标记其需要使用getter包装，不然运行时可能错误地将其认为是getter进行调用
    if (!useGetter) {
        useGetter = isEvent || expressionMaybeFunction(ast)
    }

    // 如果当前用作setter（引用传递）的目标是上下文标识符则报错（它是常量）
    if (usedAsSetter && useContext && is(ast, "Identifier")) {
        ContextIdentifierUsedAsReferenceTarget(
            expression,
            startSourceIndex,
            startSourceIndex + expression.length
        )
    }

    // 确定表达式转换为函数后参数标识符的别名
    vParam = confirmAlias(vParam, allExistingIdentifiers)
    ctxParam = confirmAlias(ctxParam, allExistingIdentifiers)
    underlineParam = confirmAlias(underlineParam, allExistingIdentifiers)

    // 根据标记的trasformInfos和expEliminateRanges转换表达式，并生成转换前后每个字符的索引映射，
    // 索引映射记录在indexMpa中，每个下标为转换前的字符索引，访问下标对应的元素即为转换后的字符索引
    // 另外，当遇到连续空字符或换行符时会被替换为一个空格以保证转换后的表达式是单行的
    // rsc: Replaced Space Count    pie: Pre(position) Is Eliminated
    for (let i = 0, offset = 0, nextOffset = 0, rsc = 0, pie = false; i <= expression.length; i++) {
        transformInfos.get(i)?.forEach(item => {
            const str = isFunction(item) ? item() : item
            transformedArr.push(str)
            if (str === "_w_") {
                nextOffset += 3
            } else {
                offset += str.length
            }
        })
        if (i < expression.length) {
            if (isIndexEliminated(i + 2, expEliminateRanges) || rsc > 0) {
                rsc > 0 && rsc--
                pie && offset--
                pie = true
            } else {
                const matched = expressionReplaceWithSpaceRE.exec(expression)
                if (matched) {
                    transformedArr.push(" ")
                    rsc = matched[0].length - 1
                } else {
                    transformedArr.push(expression[i])
                }
                if (pie) {
                    offset--
                }
                pie = false
            }
        }
        shouldGenerateSourcemap && indexMap.push(i + offset)
        expressionReplaceWithSpaceRE.lastIndex = i + 1
        offset += nextOffset
        nextOffset = 0
    }

    // 生成转换结果
    let addedPrefixLen = 0
    let transformedExp = transformedArr.join("")
    const useParenthesesWrap = /^ *{/.test(transformedExp)
    const hasContextVariable = contextVariables.length > 0
    const useInlineEventHandler = isEvent && isInlineEventHandler(ast)

    // 调试模式下会将内联ctx调用改为变量声明，这样在调试时将一段源码中不合理的断点位置，另外通过
    // 使用变量声明，在当前getter作用域内，就会存在一个与源码同名的标识符，调试时可以在调用堆栈查看
    if (hasContextVariable && !usedAsSetter) {
        const contextVariableValues = contextVariables.map(item => {
            return `${item[0]} = ${ctxParam}(${item[1]})`
        })
        const contextVariableDeclaration = `const ${contextVariableValues.join(", ")};`
        transformedExp = `{ ${contextVariableDeclaration} return ${transformedExp} }`
        addedPrefixLen += contextVariableDeclaration.length + 10
        firstMappingOffsetLeft += 7
    }

    // 调试模式下内联函数且useReturnKeyword为false时，也需要使用return关键字，不然返回值处的断点属于外层函数
    if (useInlineEventHandler) {
        if (!isDebug || firstMappingOffsetLeft) {
            transformedExp = `$arg => ${transformedExp}`
        } else {
            addedPrefixLen += 17
            firstMappingOffsetLeft += 7
            transformedExp = `$arg => { return ${transformedExp} }`
        }
    }

    // 如果使用了EventWrapperFlag，则调用eventWrapper方法将包裹事件，并传入flag参数
    if (!isUndefined(eventWrapper)) {
        const eventWrapperFuncName = getAlias("eventWrapper")
        const comment = `/* ${eventWrapper.modifiers.join(", ")} */`
        if (!useInlineEventHandler) {
            firstMappingOffsetLeft += eventWrapperFuncName.length + 1
        }
        addedPrefixLen += eventWrapperFuncName.length + 1
        transformedExp = `${eventWrapperFuncName}(${transformedExp}, ${comment} ${eventWrapper.flag})`
    }

    // 调试模式下未声明ctx变量、非内联函数且未使用eventWrapper方法时默认为转换结果添加return关键字
    // 为什么要这样处理：经过大量测试发现大多浏览器对于以纯字符串计算的表达式开头的返回值，开头断点位置都有或多或少不准确
    // 的情况，使用return关键字后可以让断点位置稳定设置在return关键字之前，这样可以保持断点位置的一致性，提高调试体验，
    // 此处理程序是为了绕过浏览器Devtools的相关BUG，如果之后Devtools修复了此BUG，可考虑移除相关处理的逻辑代码及注释
    if (usedAsSetter) {
        transformedExp = `${vParam} => (${transformedExp} = ${vParam})`
    } else if (useGetter) {
        const paramStr = useContext ? ctxParam : underlineParam
        if (useParenthesesWrap) {
            addedPrefixLen += 1
            transformedExp = `(${transformedExp})`
        }
        if (!isDebug || firstMappingOffsetLeft) {
            addedPrefixLen += paramStr.length + 4
            transformedExp = `${paramStr} => ${transformedExp}`
        } else {
            firstMappingOffsetLeft += 7
            addedPrefixLen += paramStr.length + 13
            transformedExp = `${paramStr} => { return ${transformedExp} }`
        }
    }

    // 记录表达式的sourcemap片段，注意：这里的mpaaings与sourcemap中的表示有所不同，它的四个元素
    // 分别代表：源码索引、转换后的表达式列、源码行、源码列（转换后的表达式行都为1，无需记录）
    // 在调用transformTemplate时会根据这个mappings生成正确的sourcemap的mappings
    if (shouldGenerateSourcemap && useGetter) {
        sourcemapIndexes.sort((a, b) => {
            return a - b
        })
        sourcemapIndexes.forEach(index => {
            const sourceIndex = noPositionMap
                ? index + startSourceIndex
                : optionalParams.positionMap![index]
            const generateIndex = indexMap[index] + addedPrefixLen
            if (!isUndefined(sourceIndex)) {
                mappings.push([
                    sourceIndex,
                    generateIndex,
                    inputDescriptor.positions[sourceIndex].line,
                    inputDescriptor.positions[sourceIndex].column
                ])
            }
        })

        // firstMappingOffsetLeft记录了首个映射位置需要向左偏移的量，当为转换结果
        // 添加了return关键字时，需要将首个映射位置修改为return关键字开始的位置，
        // 这样处理调试时可以保持在插值表达式的开始和结尾处设置断点的一致性
        if (firstMappingOffsetLeft && mappings[0]) {
            mappings[0][1] -= firstMappingOffsetLeft
        }
    }

    // 未转换成getter时不需要源码映射
    return mappings.length ? { mappings, transformedExp } : transformedExp
}

// 判断表达式是否是内联事件处理器
function isInlineEventHandler(node: AnyNode) {
    return !(
        isFunctionNode(node) ||
        is(node, "Identifier") ||
        is(node, "MemberExpression") ||
        is(node, "OptionalMemberExpression")
    )
}

// 判断表达式是否有可能是函数
function expressionMaybeFunction(exp: AnyNode) {
    const esExp = getEsNode(exp)
    return !(
        is(esExp, "NullLiteral") ||
        is(esExp, "RegexLiteral") ||
        is(esExp, "BigIntLiteral") ||
        is(esExp, "StringLiteral") ||
        is(esExp, "BooleanLiteral") ||
        is(esExp, "DecimalLiteral") ||
        is(esExp, "NumericLiteral") ||
        is(esExp, "TemplateLiteral") ||
        is(esExp, "UnaryExpression") ||
        is(esExp, "ArrayExpression") ||
        is(esExp, "ObjectExpression") ||
        is(esExp, "BinaryExpression") ||
        is(esExp, "UpdateExpression")
    )
}
