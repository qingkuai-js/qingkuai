import type {
    TemplateNode,
    TemplateFragment,
    TemplateNodeContext
} from "#type-declarations/compiler"
import type { CodeWriter } from "../writer"

import { SPREAD_TAG } from "../../constants"
import { stringify } from "../../../util/shared/aliases"
import { isUndefined } from "../../../util/shared/assert"
import { analyzeResult, inputDescriptor } from "../../state"
import { getNonSpreadParent } from "../../../util/compiler/template"
import { ensureIdWithNumSuffix } from "../../../util/compiler/sundry"
import { getLastElem, getLastIndex } from "../../../util/shared/arrays"
import { newCleanObj, traverseObject } from "../../../util/shared/sundry"
import { interpolatedAttrStartCharRE, omitQuoteAttrValueRE } from "../../regular"

export function generateTemplateFragments(nodes: TemplateNode[], writer: CodeWriter) {
    const compressStrings: string[] = []
    const fragments: TemplateFragment[] = []
    const directChildrenCountStack: number[] = [0]
    const { internal: internalId } = analyzeResult.generateIds
    const nodeIdCountMap: Record<string, number> = newCleanObj()
    const compressStringsMap: Record<string, number> = newCleanObj()
    const { nodeContexts, staticTextContents } = analyzeResult.template

    traverseObject(analyzeResult.template.compressStrings, (key, value) => {
        if (value.times > 1) {
            compressStringsMap[key] = compressStrings.length
            compressStrings.push(analyzeResult.commonStrings[key]?.id || stringify(key))
        }
    })

    function createTemplateFragment() {
        const fragment: TemplateFragment = {
            id: "",
            content: "",
            statements: []
        }
        return (fragments.push(fragment), fragment)
    }

    function increaseDirectChildrenCount(newStack = false) {
        directChildrenCountStack[getLastIndex(directChildrenCountStack)]++
        newStack && directChildrenCountStack.push(0)
    }

    ;(function generate(
        nodes: TemplateNode[],
        parent: TemplateNode | null,
        fragment: TemplateFragment,
        couldCreateFragment = true
    ) {
        const selectLastNode = (id: string, nodeContext?: TemplateNodeContext) => {
            const fragmentIdStart = fragments.length - 1
            const nodeIdStart = (nodeIdCountMap[id] ??= 1)
            const nodeId = ensureIdWithNumSuffix(id, nodeIdStart)
            if ((nodeIdCountMap[id]++, nodeContext)) {
                nodeContext.id = nodeId
                nodeContext.fragment = fragment
            }
            if (!fragment.id) {
                const getterId = ensureIdWithNumSuffix("createFragment", fragmentIdStart)
                fragment.id = ensureIdWithNumSuffix("fragment", fragmentIdStart)
                fragment.statements.push(`const ${fragment.id} = ${getterId}()`)
            }

            const childIndex = getLastElem(directChildrenCountStack)
            const childIndexArg = childIndex ? `, ${childIndex}` : ""
            const parentId = nodeContexts.get(parent as any)?.id || fragment.id
            const selectCall = `${internalId}.getChild(${parentId}${childIndexArg})`
            fragment.statements.push(
                nodeContext || fragment.content.endsWith(" ")
                    ? `const ${nodeId} = ${selectCall}`
                    : `const ${nodeId} = ${internalId}.replaceWithText(${selectCall})`
            )
            return nodeId
        }

        const extendFragmentContent = (str: string) => {
            if (isUndefined(compressStringsMap[str])) {
                fragment.content += str
            } else {
                fragment.content += "/" + compressStringsMap[str]
            }
        }

        for (const node of nodes) {
            if (node.isEmbedded) {
                continue
            }

            const isComment = "!" === node.tag
            const nodeContext = nodeContexts.get(node)!

            const createFragmentWithAnchor = (nodes: TemplateNode[], createByDirective = false) => {
                const useComment = fragment.content.endsWith(" ")
                extendFragmentContent(useComment ? "<!>" : " ")
                nodeContext.anchorId = selectLastNode("text")
                increaseDirectChildrenCount(true)
                nodes.length && generate(nodes, null, createTemplateFragment(), !createByDirective)
            }

            if ("slot" === node.tag) {
                if (node.children.length) {
                    if (couldCreateFragment) {
                        createFragmentWithAnchor(node.children)
                    } else {
                        generate(node.children, null, fragment)
                    }
                }
                continue
            }

            if (node.componentTag) {
                if (couldCreateFragment) {
                    createFragmentWithAnchor([])
                }
                for (const child of node.children) {
                    if (!child.tag) {
                        continue
                    }
                    generate([child], null, createTemplateFragment(), false)
                }
                continue
            }

            if (SPREAD_TAG === node.tag) {
                generate(node.children, getNonSpreadParent(node), fragment)
                continue
            }

            if (node.hasInterpolation) {
                selectLastNode(node.tag || "text", nodeContext)
            }

            if (couldCreateFragment && nodeContext.sortedDirectives.length) {
                createFragmentWithAnchor([node], true)
                continue
            }

            if ("" === node.tag) {
                if (node.hasInterpolation) {
                    extendFragmentContent(" ")
                    increaseDirectChildrenCount()
                } else {
                    const content = staticTextContents.get(node.content[0])!
                    content && increaseDirectChildrenCount()
                    extendFragmentContent(content)
                }
                continue
            }

            if ((increaseDirectChildrenCount(true), isComment)) {
                extendFragmentContent("<!--")
            } else {
                extendFragmentContent(`<${node.tag}`)
            }
            for (const attribute of node.attributes) {
                const rawName = attribute.name.raw
                const rawValue = attribute.value.raw
                if (!interpolatedAttrStartCharRE.test(rawName[0])) {
                    extendFragmentContent(" ")
                    extendFragmentContent(rawName)

                    if (attribute.equalSign) {
                        const quote = attribute.valueEnclosure === "double" ? '"' : "'"
                        const couldOmitQuote = omitQuoteAttrValueRE.test(rawValue)
                        extendFragmentContent("=")
                        couldOmitQuote || extendFragmentContent(quote)
                        extendFragmentContent(rawValue)
                        couldOmitQuote || extendFragmentContent(quote)
                    }
                }
            }
            if (inputDescriptor.styles.length) {
                extendFragmentContent(` qk-${inputDescriptor.options.hashId}`)
            }
            if (!isComment) {
                extendFragmentContent(">")
            }
            if ((generate(node.children, node, fragment), !node.isSelfClosing)) {
                extendFragmentContent(isComment ? "-->" : `</${node.tag}>`)
            }
        }
        directChildrenCountStack.pop()
    })(nodes, null, createTemplateFragment())

    for (const fragment of fragments) {
        console.log(fragment)
    }
}
