import type {
    TemplateNode,
    TemplateContext,
    ValueWithLocation,
    TemplateAnalysisRet,
    AttributeAnalysisRet
} from "../types"

import { getAlias } from "./alias"
import { analyzeAttribute } from "./attribute"
import { content2script } from "../parser/content"
import { stringConstantsSourceMap } from "../state"
import { lastElem } from "../../util/shared/sundry"
import { DuplicateSlotAttr } from "../message/error"
import { tagIsComponentRE, templateTag } from "../regular"
import { isNull, isUndefined } from "../../util/shared/assert"
import { getLocByIndex, stringify } from "../../util/compiler/state"
import { transformInterpolation } from "../transformer/interpolation"
import { kebab2Camel, normalStringify } from "../../util/compiler/sundry"

export function analyzeTemplate(
    nodes: TemplateNode[],
    parentIsComponent = false,
    context?: TemplateContext,
    continueByDirective?: string,
    awaitContextStartIndex?: number
) {
    const result: TemplateAnalysisRet[] = []

    for (let i = 0; i < nodes.length; i++) {
        let trimedContentStartIndex = 0
        let currentContext: TemplateContext
        let { tag, content, attributes, children } = nodes[i]
        let shouldHoistContent = children.length === 1 && children[0].tag === ""

        const currentRet: TemplateAnalysisRet = {
            aar: null,
            tag: "",
            content: "",
            children: [],
            isTemplate: tag === "template"
        }
        const isSlot = tag === "slot"
        const isComponent = tagIsComponentRE.test(tag)

        // 获取默认的slot属性值(default)，返回ValueWithLocationM<string>类型，其中loc
        // 为当前节点开始标签的范围，例如对于一个div节点的loc是 <div 所在的范围（用做报错位置）
        const getDefaultSlotOfAnyTag = (): ValueWithLocation<string> => {
            const nodeRange = nodes[i].range
            return {
                value: stringify("default"),
                loc: getLocByIndex(nodeRange[0], nodeRange[0] + tag.length + 1)
            }
        }

        // 如果当前节点只有一个文本子节点，可以将子节点提升为自身的textContent
        shouldHoistContent &&= !isComponent && !isSlot
        result.push(currentRet)

        // kebab组件名转为驼峰命名
        if (!isComponent) {
            currentRet.tag = stringify(tag)
        } else {
            currentRet.tag = kebab2Camel(tag, true)
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
        if (!attributes.length) {
            if (parentIsComponent) {
                currentRet.aar = {
                    eventStu: [],
                    directiveStu: [],
                    attributeStu: [],
                    slotOfAnyTag: null
                }
            }
        } else {
            let continueRE: RegExp | undefined | null
            let shouldContinueDirective: string | undefined
            const contextBeforeAnalyzeAttribute = cloneContext(currentContext)
            const aar = analyzeAttribute(
                nodes[i],
                isComponent,
                parentIsComponent,
                attributes,
                currentContext,
                continueByDirective,
                awaitContextStartIndex
            )
            currentRet.aar = aar
            continueRE = aar.continueRE
            shouldContinueDirective = aar.shouldContinueDirective

            if (parentIsComponent && isNull(aar.slotOfAnyTag)) {
                aar.slotOfAnyTag = getDefaultSlotOfAnyTag()
            }

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
                aar.slotOfAnyTag = null
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
                        aar.awaitContextStartIndex
                    )
                    const useBracketWrap = shouldUseBracketWrap(
                        nodes[i].tag,
                        childTemplateAnalysisRet.aar!
                    )
                    const childAarContinueArg = childTemplateAnalysisRet.aar!.continueArg
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
                    continueRE = childTemplateAnalysisRet.aar?.continueRE
                    shouldContinueDirective = childTemplateAnalysisRet.aar?.shouldContinueDirective
                }
            }
        }

        // 分析文本内容，如果shouldHoistContent为true，则表示当前节点只有一个文本
        // 子节点，那这个文本子节点会被提升作为当前节点的textContent部分
        if (tag !== "pre") {
            if (!shouldHoistContent) {
                trimedContentStartIndex = nodes[i].range[0]
            } else {
                content = children[0].content
                trimedContentStartIndex = children[0].range[0]
            }

            const preSpaceCount = /^\s*/.exec(content)?.[0].length || 0
            content = content.slice(preSpaceCount).trimEnd()
            trimedContentStartIndex += preSpaceCount
        }
        if (tag === "!") {
            currentRet.content = normalStringify(content)
        } else if (currentRet.aar?.nameOfSlotTag) {
            currentRet.content = currentRet.aar.nameOfSlotTag.value
        } else {
            const parseRet = content2script(content, trimedContentStartIndex)
            const teOptionalParam = { positionMap: parseRet.positionMap }
            currentRet.content = transformInterpolation(
                parseRet.script,
                trimedContentStartIndex,
                currentContext,
                "content",
                teOptionalParam
            )
        }

        // 递归处理当前节点的所有子节点
        if (!shouldHoistContent) {
            const existingSlotValues = new Set<string>()
            analyzeTemplate(children, isComponent, currentContext).forEach(childRet => {
                const slot = childRet.aar?.slotOfAnyTag
                if (slot) {
                    if (existingSlotValues.has(slot.value)) {
                        const restoredSlotName = stringConstantsSourceMap.get(slot.value)!
                        DuplicateSlotAttr(JSON.parse(restoredSlotName), tag, slot.loc)
                    }
                    existingSlotValues.add(slot.value)
                }
                currentRet.children.push({
                    tar: childRet,
                    useBracket: Boolean(slot)
                })
            })
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
        templateTag.test(tag) &&
        !removeBrackWrapFuncNames.has(lastElem(aar.directiveStu)?.[0] as string)
    )
}
