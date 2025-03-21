import type {
    TemplateNode,
    TemplateContext,
    TemplateAnalysisRet,
    AttributeAnalysisRet
} from "../types"

import { getAlias } from "./alias"
import { analyzeAttribute } from "./attribute"
import { content2script } from "../parser/content"
import { lastElem } from "../../util/shared/sundry"
import { markPositionFlag } from "../../util/compiler/sundry"
import { inputDescriptor, interCodeSnippets } from "../state"
import { IntercodeSnippetKind, SPECIAL_TAGS } from "../constants"
import { transformInterpolation } from "../transformer/interpolation"
import { isEmptyString, isUndefined } from "../../util/shared/assert"
import { kebab2Camel, normalStringify, stringify } from "../../util/compiler/strings"

export function analyzeTemplate(
    nodes: TemplateNode[],
    parentIsComponent = false,
    context?: TemplateContext,
    continueByDirective?: string,
    awaitExpression?: [number, string],
    existingSlotOfAnyTag = new Set<string>()
) {
    const result: TemplateAnalysisRet[] = []

    // 嵌入语言标签节点无需分析处理
    nodes = nodes.filter(node => !node.isEmbedded)

    for (let i = 0; i < nodes.length; i++) {
        let { tag, content, attributes, children, componentTag } = nodes[i]

        let trimedContentStartIndex: number
        let currentContext: TemplateContext
        let continueRE: RegExp | undefined | null
        let shouldContinueDirective: string | undefined
        let shouldHoistContent = children.length === 1 && children[0].tag === ""

        const currentRet: TemplateAnalysisRet = {
            aar: null,
            tag: "",
            content: "",
            children: [],
            isTemplate: tag === "template"
        }
        const isSlot = tag === "slot"
        const isTextarea = tag === "textarea"
        const isComponent = !isEmptyString(componentTag)

        // 如果当前节点只有一个文本子节点，可以将子节点提升为自身的textContent
        shouldHoistContent &&= !isComponent && !isSlot
        result.push(currentRet)

        // kebab组件名转为驼峰命名
        if (!isComponent) {
            currentRet.tag = stringify(tag)
        } else {
            currentRet.tag = kebab2Camel(tag, true)
            markPositionFlag(nodes[i].range[0], "isComponentStart")
        }

        if (isUndefined(context)) {
            currentContext = context = {
                count: 0,
                map: new Map()
            }
        } else {
            currentContext = cloneContext(context)
        }

        // 分析属性列表
        const contextBeforeAnalyzeAttribute = cloneContext(currentContext)
        const aar = analyzeAttribute(
            nodes[i],
            isComponent,
            parentIsComponent,
            attributes,
            currentContext,
            existingSlotOfAnyTag,
            continueByDirective,
            awaitExpression
        )
        currentRet.aar = aar
        continueRE = aar.continueInfo?.re
        shouldContinueDirective = aar.continueInfo?.by

        // 对于使用了if指令或await指令的节点可能需要创建一个template挂载点，因为此时
        // 需要将多个节点结构作为参数传入ifMNodule/awaitModule
        if (aar.createTemplate) {
            const useBracketWrap = shouldUseBracketWrap(tag, aar)
            const awaitNullChild = { tar: null, useBracket: false }
            const mockTemplateRet: TemplateAnalysisRet = {
                isTemplate: true,
                tag: "template",
                content: "",
                aar: {
                    eventStu: [],
                    attributeStu: [],
                    slotOfAnyTag: aar.slotOfAnyTag,
                    directiveStu: [aar.directiveStu[0]]
                },
                children: [
                    {
                        tar: currentRet,
                        useBracket: useBracketWrap
                    }
                ]
            }
            result.pop()
            result.push(mockTemplateRet)
            aar.directiveStu = aar.directiveStu.slice(1)

            if (aar.insertNullNum) {
                for (let i = 0; i < aar.insertNullNum; i++) {
                    mockTemplateRet.children.unshift(awaitNullChild)
                }
            }

            // 如果后一个兄弟节点节点是当前节点的后续指令（elif/else - if、then/catch - await)，
            // 优先处理后一个兄弟节点，如果按照正常顺序会先递归处理当前节点的所有子节点，但如果是连接
            // 指令就需要先将当前指令的所有后续指令都处理完，再递归处理当前节点的子节点
            while (shouldContinue(nodes[i + 1], continueRE)) {
                const cotinueContext = cloneContext(contextBeforeAnalyzeAttribute)
                const [childTemplateAnalysisRet] = analyzeTemplate(
                    [nodes[++i]],
                    isComponent,
                    cotinueContext,
                    shouldContinueDirective,
                    aar.awaitExpression,
                    existingSlotOfAnyTag
                )
                const useBracketWrap = shouldUseBracketWrap(
                    nodes[i].tag,
                    childTemplateAnalysisRet.aar!
                )
                const childAarContinueArg = childTemplateAnalysisRet.aar!.continueInfo?.arg
                if (childTemplateAnalysisRet.aar?.insertNullNum) {
                    mockTemplateRet.children.push(awaitNullChild)
                }
                if (childAarContinueArg) {
                    mockTemplateRet.aar!.directiveStu[0].push(childAarContinueArg)
                }
                mockTemplateRet.children.push({
                    useBracket: useBracketWrap,
                    tar: childTemplateAnalysisRet
                })
                continueRE = childTemplateAnalysisRet.aar?.continueInfo?.re
                shouldContinueDirective = childTemplateAnalysisRet.aar?.continueInfo?.by
            }
        }

        // 分析文本内容，如果shouldHoistContent为true，则表示当前节点只有
        // 一个文本子节点，那这个文本子节点会被提升作为当前节点的textContent部分
        if (shouldHoistContent) {
            content = children[0].content
            trimedContentStartIndex = children[0].range[0]
        } else {
            trimedContentStartIndex = isTextarea ? nodes[i].startTagEndPos.index : nodes[i].range[0]
        }

        // 注释以及pre、textarea节点的内容不去除开头和结尾的空白字符
        if (!isTextarea && tag !== "!" && !nodes[i].preWhiteSpace) {
            const preSpaceCount = /^\s*/.exec(content)?.[0].length || 0
            content = content.slice(preSpaceCount).trimEnd()
            trimedContentStartIndex += preSpaceCount
        }

        if (SPECIAL_TAGS.has(tag)) {
            currentRet.content = normalStringify(content)
        } else if (currentRet.aar?.nameOfSlotTag) {
            currentRet.content = currentRet.aar.nameOfSlotTag
        } else {
            const parseRet = content2script(content, trimedContentStartIndex)
            const optionalParam = { positionMap: parseRet.positionMap }
            if (!inputDescriptor.options.check) {
                currentRet.content = transformInterpolation(
                    parseRet.script,
                    trimedContentStartIndex,
                    currentContext,
                    "content",
                    optionalParam
                )
            }
        }

        // 递归处理当前节点的所有子节点，在这里判断组件中多个子标签上的slot属性是否重复
        if (!shouldHoistContent && !isTextarea) {
            analyzeTemplate(
                children,
                isComponent,
                currentContext,
                undefined,
                undefined,
                new Set()
            ).forEach(childRet => {
                currentRet.children.push({
                    tar: childRet,
                    useBracket: Boolean(childRet.aar?.slotOfAnyTag)
                })
            })
        }

        // 检查模式下，如果属性（目前单指指令）产生了上下文标识符，会在中间代码中插入块级作用域，属性分析结果中的
        // contextBlockCount记录了当前节点创建的块级作用域数量，这里要将对应数量的闭合花括号记录到中间代码片段
        if (inputDescriptor.options.check) {
            const contextBlockCount = currentRet.aar?.contextBlockCount || 0
            contextBlockCount &&
                interCodeSnippets.push([
                    IntercodeSnippetKind.SearchForward,
                    "}".repeat(contextBlockCount)
                ])
        }
    }

    return result
}

// 拷贝一份context，得到的新context中的map属性的每一个标识符转换项与原context中
// 为同一个对象，修改to/pto会影响原context，但这个新context会拥有自己独立的计数器，
// 也就是说拷贝后的context和原context添加新标识符或删除旧标识符不会影响到另一个
function cloneContext(context: TemplateContext): TemplateContext {
    return {
        count: context.count,
        map: new Map(context.map)
    }
}

// 判断节点是否是指定指令的后续操作
function shouldContinue(node: TemplateNode, re: RegExp | undefined | null) {
    if (isUndefined(node) || !re) {
        return false
    }
    return node.attributes.some(attr => {
        return re.test(attr.key.raw)
    })
}

// 判断展开的多个节点是否需要使用中括号包裹(template标签中的节点)
function shouldUseBracketWrap(tag: string, aar: AttributeAnalysisRet) {
    const removeBrackWrapFuncNames = new Set([
        getAlias("forModule", false),
        getAlias("aliasModule", false),
        getAlias("keyedForModule", false)
    ])
    return (
        tag === "template" &&
        !removeBrackWrapFuncNames.has(lastElem(aar.directiveStu)?.[0] as string)
    )
}
