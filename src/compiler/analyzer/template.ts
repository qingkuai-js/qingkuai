import type {
    TemplateNode,
    TemplateContext,
    TemplateAnalysisRet,
    AttributeAnalysisRet
} from "../types"

import { getAlias } from "./alias"
import { analyzeAttribute } from "./attribute"
import { content2script } from "../parser/content"
import { getLocByIndex } from "../../util/compiler/locations"
import { lastElem, spliceByElem } from "../../util/shared/sundry"
import { transformInterpolation } from "../transformer/interpolation"
import { isEmptyString, isUndefined } from "../../util/shared/assert"
import { getCacheId, inputDescriptor, interCodeSnippets } from "../state"
import { IntercodeSnippetKind, SPECIAL_TAGS, SPREAD_TAG } from "../constants"
import { isSelfClosingTag, markPositionFlag } from "../../util/compiler/sundry"
import { kebab2Camel, normalStringify, stringify } from "../../util/compiler/strings"
import { BadTargetForHtmlDirective, HtmlDirectiveWithChildElement } from "../message/error"

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

    for (let i = 0, node = nodes[0]; i < nodes.length; node = nodes[++i]) {
        let { tag, content, attributes, children, componentTag, pure, parent } = node

        let shouldHoistContent = false
        let trimedContentStartIndex: number
        let currentContext: TemplateContext
        let continueRE: RegExp | undefined | null
        let shouldContinueDirective: string | undefined
        let htmlDirective = attributes.find(({ key }) => key.raw === "#html")

        const isSlot = tag === "slot"
        const isText = isEmptyString(tag)
        const isTextarea = tag === "textarea"
        const isComponent = !isEmptyString(componentTag)
        const shouldCache = pure && !parent?.pure && !isSlot && !isComponent

        const unsetHtmlDirective = () => {
            if (htmlDirective) {
                htmlDirective = undefined
                spliceByElem(attributes, htmlDirective)
            }
        }

        const curRetItem: TemplateAnalysisRet = {
            aar: null,
            tag: "",
            content: "",
            children: [],
            isSpread: tag === SPREAD_TAG,
            cacheId: shouldCache && !isText ? getCacheId() : -1
        }

        // 如果当前节点只有一个文本子节点，可以将子节点提升为自身的textContent
        if (
            !isSlot &&
            !isComponent &&
            !curRetItem.isSpread &&
            children.length === 1 &&
            isEmptyString(children[0].tag)
        ) {
            shouldHoistContent = true
        }

        if (htmlDirective && !isText) {
            // 组件、slot以及自闭合标签上不能使用#html指令
            if (isComponent || isSlot || isSelfClosingTag(tag)) {
                unsetHtmlDirective()
                BadTargetForHtmlDirective(htmlDirective.loc)
            }

            // 使用了#html指令的节点只能接受一个text节点
            if (children.length !== 1 || !isEmptyString(children[0].tag)) {
                HtmlDirectiveWithChildElement(
                    getLocByIndex(node.range[0], node.range[0] + tag.length + 1)
                )
            }

            // 如果当前标签使用了#html指令且非SPREAD_TAG，则将#html指令转移到content上
            if (htmlDirective && !curRetItem.isSpread) {
                shouldHoistContent = false
                children[0]?.attributes.push(htmlDirective)
            }
        }

        // kebab组件名转为驼峰命名
        if (isComponent) {
            curRetItem.tag = kebab2Camel(tag, true)
            markPositionFlag(node.range[0], "isComponentStart")
        } else {
            if (!isText || htmlDirective) {
                curRetItem.tag = stringify(tag)
            } else {
                const insertCommment = inputDescriptor.options.comment
                curRetItem.tag = (insertCommment ? "/* cache id */ " : "") + getCacheId()
            }
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
            node,
            isComponent,
            parentIsComponent,
            attributes,
            currentContext,
            existingSlotOfAnyTag,
            continueByDirective,
            awaitExpression
        )
        curRetItem.aar = aar
        result.push(curRetItem)
        continueRE = aar.continueInfo?.re
        shouldContinueDirective = aar.continueInfo?.by

        // 对于使用了if指令或await指令的节点可能需要创建一个template挂载点，因为此时
        // 需要将多个节点结构作为参数传入ifMNodule/awaitModule
        if (aar.createSpread) {
            const useBracketWrap = shouldUseBracketWrap(tag, aar)
            const awaitNullChild = { tar: null, useBracket: false }
            const mockSpreadRet: TemplateAnalysisRet = {
                tag: SPREAD_TAG,
                content: "",
                cacheId: -1,
                isSpread: true,
                aar: {
                    eventStu: [],
                    attributeStu: [],
                    slotOfAnyTag: aar.slotOfAnyTag,
                    directiveStu: [aar.directiveStu[0]]
                },
                children: [
                    {
                        tar: curRetItem,
                        useBracket: useBracketWrap
                    }
                ]
            }
            result.pop()
            result.push(mockSpreadRet)
            aar.directiveStu = aar.directiveStu.slice(1)

            if (aar.insertNullNum) {
                for (let i = 0; i < aar.insertNullNum; i++) {
                    mockSpreadRet.children.unshift(awaitNullChild)
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
                const useBracketWrap = shouldUseBracketWrap(node.tag, childTemplateAnalysisRet.aar!)
                const childAarContinueArg = childTemplateAnalysisRet.aar!.continueInfo?.arg
                if (childTemplateAnalysisRet.aar?.insertNullNum) {
                    mockSpreadRet.children.push(awaitNullChild)
                }
                if (childAarContinueArg) {
                    mockSpreadRet.aar!.directiveStu[0].push(childAarContinueArg)
                }
                mockSpreadRet.children.push({
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
            trimedContentStartIndex = isTextarea ? node.startTagEndPos.index : node.range[0]
        }

        // 注释以及pre、textarea节点的内容不去除开头和结尾的空白字符
        if (!isTextarea && tag !== "!" && !node.pref) {
            const preSpaceCount = /^\s*/.exec(content)?.[0].length || 0
            content = content.slice(preSpaceCount).trimEnd()
            trimedContentStartIndex += preSpaceCount
        }

        if (SPECIAL_TAGS.has(tag)) {
            curRetItem.content = normalStringify(content)
        } else if (curRetItem.aar?.nameOfSlotTag) {
            curRetItem.content = curRetItem.aar.nameOfSlotTag
        } else {
            const parseRet = content2script(content, trimedContentStartIndex, node.pref)
            const optionalParam = { positionMap: parseRet.positionMap }
            if (!inputDescriptor.options.check) {
                curRetItem.content = transformInterpolation(
                    parseRet.script,
                    trimedContentStartIndex,
                    currentContext,
                    { ...optionalParam, type: "content" }
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
                curRetItem.children.push({
                    tar: childRet,
                    useBracket: Boolean(childRet.aar?.slotOfAnyTag)
                })
            })
        }

        // 检查模式下，如果属性（目前单指指令）产生了上下文标识符，会在中间代码中插入块级作用域，属性分析结果中的
        // contextBlockCount记录了当前节点创建的块级作用域数量，这里要将对应数量的闭合花括号记录到中间代码片段
        if (inputDescriptor.options.check) {
            const contextBlockCount = curRetItem.aar?.contextBlockCount || 0
            if (contextBlockCount) {
                interCodeSnippets.push([
                    IntercodeSnippetKind.SearchForward,
                    "}".repeat(contextBlockCount)
                ])
            }
        }

        // 如果上下文中存在于组件名称相同的标识符，则采用上下文中的值作为组件类
        if (isComponent && currentContext.map.has(curRetItem.tag)) {
            curRetItem.tag = `ctx => ctx(${currentContext.map.get(curRetItem.tag)!.num})`
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

// 判断展开的多个节点是否需要使用中括号包裹(SPREAD_TAG中的节点)
function shouldUseBracketWrap(tag: string, aar: AttributeAnalysisRet) {
    const removeBrackWrapFuncNames = new Set([
        getAlias("forModule", false),
        getAlias("aliasModule", false),
        getAlias("keyedForModule", false)
    ])
    return (
        tag === SPREAD_TAG &&
        !removeBrackWrapFuncNames.has(lastElem(aar.directiveStu)?.[0] as string)
    )
}
