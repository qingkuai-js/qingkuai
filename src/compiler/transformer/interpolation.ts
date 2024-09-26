import type { AnyNode } from "../estree/types"
import type { FixedArray } from "../../util/types"
import type { GeneralFunc } from "../../runtime/types"
import type { EliminateRanges, TemplateContext, TransformExpressionOptionalParam } from "../types"

import { walk } from "../estree/walk"
import { getAlias } from "../analyzer/alias"
import { runAll } from "../../util/shared/sundry"
import { compilerOptions } from "../configuration"
import { stringify } from "../../util/compiler/state"
import { is, isFunctionNode } from "../estree/assert"
import { isUndefined } from "../../util/shared/assert"
import { identifierIsReference } from "../estree/assert"
import { inputDescriptor, replacementInfo } from "../state"
import { isIndexEliminated } from "../../util/compiler/sundry"
import { getEsNode, getEsNodeOfParent, parse } from "../../util/compiler/estree"
import { bannedIdentifierFormat, expressionReplaceWithSpaceRE } from "../regular"
import { BadValueForRefAttr, IdentifierFormatIsNotAllowed } from "../message/error"

export function transformExpression(
    expression: string,
    startIndex: number,
    context: TemplateContext,
    type: "directive" | "attribute" | "event" | "content",
    optionalParams: TransformExpressionOptionalParam = {}
) {
    let useGetter = false
    let useContext = false
    let useReturnKeyword = false

    const indexMap: number[] = []
    const transformedArr: string[] = []
    const contextVariables: string[] = []
    const sourcemapIndexes: number[] = []
    const afterWalkFuncs: GeneralFunc[] = []
    const mappings: FixedArray<number, 4>[] = []
    const expEliminateRanges: EliminateRanges = new Set()
    const transformInfos: Map<number, string[]> = new Map()

    const isDebug = compilerOptions.debugeMode
    const noPositionMap = isUndefined(optionalParams.positionMap)
    const isKeyDirective = optionalParams.isKeyDirective || false
    const isComponentEvent = optionalParams.isComponentEvent === true
    const shouldGenerateSourcemap = compilerOptions.generateSourcemap
    const ast = (parse("_=" + expression).body[0] as any).expression.right
    const isEvent = !isUndefined(optionalParams.eventWrapperFlag) || isComponentEvent

    // 扩展转换信息数组
    const extendTransformInfo = (index: number, str: string) => {
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
        BadValueForRefAttr(expression)
    }

    walk(ast, {
        Identifier(node, parent) {
            const { name, start, end } = node

            if (bannedIdentifierFormat.test(name)) {
                IdentifierFormatIsNotAllowed(name)
            }
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
                extendTransformInfo(node.start, `${name}: `)
            }

            if (ctx) {
                useGetter = true
                useContext = true
                if (!isDebug || type === "directive") {
                    if (!isKeyDirective) {
                        extendTransformInfo(end, ctx.to)
                    } else {
                        extendTransformInfo(end, ctx.pto!)
                    }
                    expEliminateRanges.add([start, end])
                } else {
                    contextVariables.push(`${name} = ${ctx.to}`)
                }
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
                extendTransformInfo(callee.start!, "ctx(")
                afterWalkFuncs.push(() => {
                    extendTransformInfo(callee.end!, ")")
                })
            }
        },
        StringLiteral(node) {
            extendTransformInfo(node.end, stringify(node.value))
            expEliminateRanges.add([node.start, node.end])
        },

        // 标记需要记录sourcemap信息的索引（这里值表达式转换前的索引，转换完成后，
        // 可以通过访问indexMap[转换前的索引]来换取它对应的转换后的表达式位置索引
        AnyNode(node) {
            if (startIndex !== -1) {
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

    // 根据标记的trasformInfos和expEliminateRanges转换表达式，并生成转换前后每个字符的索引映射，
    // 索引映射记录在indexMpa中，每个下标为转换前的字符索引，访问下标对应的元素即为转换后的字符索引
    // 另外，当遇到连续空字符或换行符时会被替换为一个空格以保证转换后的表达式是单行的
    // rsc: Replaced Space Count    pie: Pre(position) Is Eliminated
    for (
        let i = 0, offset = 0, nextOffset = 0, rsc = 0, pie = false;
        shouldGenerateSourcemap && i <= expression.length;
        i++
    ) {
        transformInfos.get(i)?.forEach(str => {
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
        expressionReplaceWithSpaceRE.lastIndex = i + 1
        indexMap.push(i + offset)
        offset += nextOffset
        nextOffset = 0
    }

    // 生成转换结果
    let addedPrefixLen = 0
    let transformedExp = transformedArr.join("")
    const useParenthesesWrap = /^ *{/.test(transformedExp)
    const useInlineEventHandler = isEvent && isInlineEventHandler(ast)

    // 调试模式下会将内联ctx调用改为变量声明，这样在调试时将一段源码中不合理的断点位置，另外通过
    // 使用变量声明，在当前getter作用域内，就会存在一个与源码同名的标识符，调试时可以在调用堆栈查看
    if (contextVariables.length) {
        const cvds = `const ${contextVariables.join(", ")};`
        transformedExp = `{ ${cvds} return ${transformedExp} }`
        addedPrefixLen += cvds.length + 10
        useReturnKeyword = true
    }

    // 内联函数时，如果是调试模式，这里也需要使用return关键字，不然返回返回值处的断点属于外层函数
    if (useInlineEventHandler) {
        const paramStr = isComponentEvent ? "param" : "event"
        if (!isDebug) {
            transformedExp = `${paramStr} => ${transformedExp}`
        } else {
            useReturnKeyword = true
            addedPrefixLen += paramStr.length + 13
            transformedExp = `${paramStr} => { return ${transformedExp} }`
        }
    }

    if (optionalParams.eventWrapperFlag) {
        const flag = optionalParams.eventWrapperFlag
        const eventWrapperFuncName = getAlias("eventWradpper")
        addedPrefixLen += eventWrapperFuncName.length + 1
        transformedExp = `${eventWrapperFuncName}(${transformedExp}, ${flag})`
    }

    // 当 usedAsSetter 被设置时，代表这个表达式在一个setter中，此时如果转换后的表达式添加了
    // _w_前缀或.$后缀，都应该将原始的标识符一同修改（这种情况主要出现在引用属性值中）
    if (optionalParams.usedAsSetter) {
        transformedExp += ` = ${expression}`
    } else if (useGetter) {
        const paramStr = useContext ? "ctx" : "_"
        if (useParenthesesWrap) {
            addedPrefixLen += 1
            transformedExp = `(${transformedExp})`
        }
        addedPrefixLen += (useContext ? 3 : 1) + 4
        transformedExp = `${paramStr} => ${transformedExp}`
    }

    // 记录表达式的sourcemap片段，注意：这里的mpaaings与sourcemap中的表示有所不同，它的四个元素
    // 分别代表：源码索引、转换后的表达式列、源码行、源码列（转换后的表达式行都为1，无需记录）
    // 在调用transformTemplate时会根据这个mappings生成正确的sourcemap的mappings
    if (shouldGenerateSourcemap && useGetter) {
        sourcemapIndexes.forEach(index => {
            const sourceIndex = noPositionMap
                ? index + startIndex
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

        // 如果useReturnKeyword为true，（主要为调试模式下使用了ctx或内联方法的情况），
        // 则需要将首个映射段修改为return关键字开始的位置，这样在调试时可以保持在生成
        // 函数的return语句开始和结束处都可以设置断点的一致性
        if (useReturnKeyword && mappings[0]) {
            mappings[0][1] = addedPrefixLen - 7
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
