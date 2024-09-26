import type {
    TemplateNode,
    TemplateContext,
    TemplateAnalysisRet,
    AttributeAnalysisRet
} from "../types"

import { getAlias } from "./alias"
import { analyzeAttribute } from "./attribute"
import { content2script } from "../parser/content"
import { stringify } from "../../util/compiler/state"
import { tagIsComponentRE, templateTag } from "../regular"
import { isNull, isUndefined } from "../../util/shared/assert"
import { DuplicateSlotAttributeValue } from "../message/error"
import { transformExpression } from "../transformer/interpolation"
import { kebab2Camel, normalStringify } from "../../util/compiler/sundry"
import { lastElem } from "../../util/shared/sundry"

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

        const isSlot = tag === "slot"
        const isComponent = tagIsComponentRE.test(tag)
        const currentRet: TemplateAnalysisRet = {
            aar: null,
            tag: "",
            content: "",
            children: []
        }
        result.push(currentRet)
        shouldHoistContent &&= !isComponent && !isSlot

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
                    slot: stringify("default")
                }
            }
        } else {
            let continueRE: RegExp | undefined | null
            let curContinuedDirective: string | undefined
            const contextBeforeAnalyzeAttribute = cloneContext(currentContext)
            const aar = analyzeAttribute(
                tag,
                isComponent,
                parentIsComponent,
                attributes,
                currentContext,
                continueByDirective,
                awaitContextStartIndex
            )
            currentRet.aar = aar
            continueRE = aar.continueRE
            curContinuedDirective = aar.continuedDirective

            if (parentIsComponent && !aar.slot) {
                aar.slot = stringify("default")
            }

            if ((!isNull(aar.continueRE) || aar.insertNullNum) && aar.createTemplate) {
                const useBracketWrap = shouldUseBracketWrap(tag, aar)
                const awaitNullChildTempl = { tar: null, useBracket: false }
                const mockTemplateRet: TemplateAnalysisRet = {
                    tag: "template",
                    content: "",
                    aar: {
                        slot: aar.slot,
                        eventStu: [],
                        attributeStu: [],
                        directiveStu: aar.directiveStu.slice(0, 1)
                    },
                    children: [
                        {
                            tar: currentRet,
                            useBracket: useBracketWrap
                        }
                    ]
                }
                aar.slot = ""
                result.pop()
                result.push(mockTemplateRet)
                aar.directiveStu = aar.directiveStu.slice(1)

                if (aar.insertNullNum) {
                    for (let i = 0; i < aar.insertNullNum; i++) {
                        mockTemplateRet.children.unshift(awaitNullChildTempl)
                    }
                }
                while (shouldContinue(nodes[i + 1], continueRE)) {
                    const cotinueContext = cloneContext(contextBeforeAnalyzeAttribute)
                    const [childTemplateAnalysisRet] = analyzeTemplate(
                        [nodes[++i]],
                        isComponent,
                        cotinueContext,
                        curContinuedDirective,
                        aar.awaitContextStartIndex
                    )
                    const useBracketWrap = shouldUseBracketWrap(
                        nodes[i].tag,
                        childTemplateAnalysisRet.aar!
                    )
                    const childAarContinueArg = childTemplateAnalysisRet.aar!.continueArg
                    if (childTemplateAnalysisRet.aar?.insertNullNum) {
                        mockTemplateRet.children.push(awaitNullChildTempl)
                    }
                    if (childAarContinueArg) {
                        mockTemplateRet.aar!.directiveStu[0].push(childAarContinueArg)
                    }
                    mockTemplateRet.children.push({
                        useBracket: useBracketWrap,
                        tar: childTemplateAnalysisRet
                    })
                    continueRE = childTemplateAnalysisRet.aar?.continueRE
                    curContinuedDirective = childTemplateAnalysisRet.aar?.continuedDirective
                }
            }
        }

        // 分析文本内容
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
        if (currentRet.aar?.slotName) {
            currentRet.content = currentRet.aar.slotName
        } else if (tag === "!") {
            currentRet.content = normalStringify(content)
        } else {
            const parseRet = content2script(content, trimedContentStartIndex)
            const teOptionalParam = { positionMap: parseRet.positionMap }
            currentRet.content = transformExpression(
                parseRet.script,
                trimedContentStartIndex,
                currentContext,
                "content",
                teOptionalParam
            )
        }

        // 分析子节点
        if (!shouldHoistContent) {
            const existingSlotValues = new Set<string>()
            analyzeTemplate(children, isComponent, currentContext).forEach(childRet => {
                const slot = childRet.aar?.slot
                if (slot) {
                    if (existingSlotValues.has(slot)) {
                        DuplicateSlotAttributeValue(slot)
                    }
                    existingSlotValues.add(slot)
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

// 拷贝一份context，得到的新context对象的修改将会影响源对象
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

// 判断展开的节点是否需要使用中括号包裹
function shouldUseBracketWrap(tag: string, aar: AttributeAnalysisRet) {
    const removeBrackWrapFuncNames = new Set([
        getAlias("forModule", false),
        getAlias("aliasModule", false)
    ])
    return templateTag.test(tag) && !removeBrackWrapFuncNames.has(lastElem(aar.directiveStu)?.[0])
}
