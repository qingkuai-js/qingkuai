import type {
    TemplateNode,
    TemplateFragment,
    TemplateNodeContext
} from "#type-declarations/compiler"
import type { CodeWriter } from "../writer"

import {
    isHtmlDirectiveChild,
    getTemplateNodeContext,
    getGeneratedStaticTextContent
} from "../../../util/compiler/template"
import {
    ensureIdWithPrefix,
    getMaybeReusedString,
    ensureIdWithNumSuffix,
    increaseCompressStringUsedTimes
} from "../../../util/compiler/sundry"
import { getLastElem } from "../../../util/shared/arrays"
import { analyzeResult, inputDescriptor } from "../../state"
import { CREATE_ANCHOR_DIRECTIVES, SPREAD_TAG } from "../../constants"
import { newCleanObj, traverseObject } from "../../../util/shared/sundry"
import { interpolatedAttrStartCharRE, omitQuoteAttrValueRE } from "../../regular"

export function getTemplateFragments(nodes: TemplateNode[]) {
    if (!nodes.length) {
        return []
    }

    const fragments: TemplateFragment[] = []
    const nodeIdCountMap: Record<string, number> = newCleanObj()
    const existingFragmentContentMap: Record<string, TemplateFragment> = newCleanObj()

    function extendFragments(nodeContext: TemplateNodeContext) {
        const fragment: TemplateFragment = (nodeContext.fragment = {
            id: "",
            content: [],
            getterId: "",
            selections: [],
            getWith: undefined,
            directChildrenCount: 0,
            usedCompressString: false
        })
        return (fragments.push(fragment), fragment)
    }

    ;(function generate(
        nodes: TemplateNode[],
        fragment: TemplateFragment,
        parent: TemplateNode | null
    ) {
        const increaseDirectChildrenCount = () => {
            if (!parent) {
                fragment.directChildrenCount++
            } else {
                getTemplateNodeContext(parent).selectedChildCount++
            }
        }

        const selectLastNode = (id: string, nodeContext?: TemplateNodeContext) => {
            const nodeIdStart = (nodeIdCountMap[id] ??= 1)
            const nodeId = ensureIdWithNumSuffix(id, nodeIdStart)
            const parentContext = parent && getTemplateNodeContext(parent)
            if ((nodeIdCountMap[id]++, nodeContext)) {
                nodeContext.id = nodeId
            }
            fragment.selections.push({
                id: nodeId,
                parent: parentContext?.id,
                index: parentContext?.selectedChildCount ?? fragment.directChildrenCount
            })
            return nodeId
        }

        for (const node of nodes) {
            if (node.isEmbedded) {
                continue
            }

            const isComment = "!" === node.tag
            const nodeContext = getTemplateNodeContext(node)

            const createFragmentWithAnchor = (nodes: TemplateNode[]) => {
                const useComment = getLastElem(fragment.content) === " "
                const existringFragment = nodeContext.fragment ?? extendFragments(nodeContext)
                fragment.content.push(useComment ? "<!>" : " ")
                nodeContext.anchorId = selectLastNode("text")
                increaseDirectChildrenCount()
                generate(nodes, existringFragment, null)
            }

            if ("slot" === node.tag) {
                createFragmentWithAnchor(node.children)
                continue
            }

            if (node.componentTag) {
                createFragmentWithAnchor([])

                for (const child of node.children) {
                    const childContext = getTemplateNodeContext(child)
                    generate([child], extendFragments(childContext), null)
                }
                continue
            }

            if (nodeContext.sortedDirectives.length && !nodeContext.fragment) {
                if (CREATE_ANCHOR_DIRECTIVES.has(nodeContext.sortedDirectives[0].name.raw)) {
                    createFragmentWithAnchor([node])
                } else {
                    nodeContext.anchorId = getTemplateNodeContext(
                        getPrevHasDirectiveSibling(node)!
                    ).anchorId
                    generate([node], extendFragments(nodeContext), null)
                }
                continue
            }

            if (SPREAD_TAG === node.tag) {
                generate(node.children, fragment, getSelectableParentNode(node))
                continue
            }

            if (nodeContext.shouldBeSelected) {
                selectLastNode(node.tag || "text", nodeContext)
            }

            if ("" === node.tag) {
                if (!isHtmlDirectiveChild(node)) {
                    if (nodeContext.shouldBeSelected) {
                        fragment.content.push(" ")
                        increaseDirectChildrenCount()
                    } else {
                        const content = getGeneratedStaticTextContent(node.content[0])!
                        if (content) {
                            increaseDirectChildrenCount()
                            fragment.content.push(content)
                        }
                    }
                }
                continue
            }

            if (isComment) {
                fragment.content.push("<!--")
            } else {
                fragment.content.push(`<${node.tag}`)
            }
            for (const attribute of node.attributes) {
                const rawName = attribute.name.raw
                const rawValue = attribute.value.raw
                if (!interpolatedAttrStartCharRE.test(rawName[0])) {
                    fragment.content.push(" ")
                    fragment.content.push(rawName)

                    if (attribute.equalSign) {
                        const quote = attribute.valueEnclosure === "double" ? '"' : "'"
                        const couldOmitQuote = omitQuoteAttrValueRE.test(rawValue)
                        fragment.content.push("=")
                        couldOmitQuote || fragment.content.push(quote)
                        fragment.content.push(rawValue)
                        couldOmitQuote || fragment.content.push(quote)
                    }
                }
            }
            if (inputDescriptor.styles.length) {
                fragment.content.push(` qk-${inputDescriptor.options.hashId}`)
            }
            if (!isComment) {
                fragment.content.push(">")
            }
            increaseDirectChildrenCount()
            generate(node.children, fragment, node)
            node.isSelfClosing || fragment.content.push(isComment ? "-->" : `</${node.tag}>`)
        }
    })(nodes, extendFragments(getTemplateNodeContext(nodes[0])), null)

    for (const fragment of fragments) {
        const joinedContent = fragment.content.join("")
        if ((fragment.getWith = existingFragmentContentMap[joinedContent])) {
            continue
        } else {
            existingFragmentContentMap[joinedContent] = fragment
        }
        for (const str of fragment.content) {
            increaseCompressStringUsedTimes(str)
        }
    }
    return fragments
}

export function generateTemplateFragments(fragments: TemplateFragment[], writer: CodeWriter) {
    let fragmentsCount = 0
    let compressStringsId = ""

    const validCompressStrings: string[] = []
    const isTesting = process.env.VITEST === "true"
    const internalId = analyzeResult.generateIds.internal

    traverseObject(analyzeResult.template.compressStrings, (key, value) => {
        if (value.times > 1) {
            analyzeResult.template.compressStrings[key].index = validCompressStrings.length
            validCompressStrings.push(getMaybeReusedString(key))
        }
    })

    // 生成压缩字符串数组声明
    // Generate the declaration for the compressed strings array.
    if (validCompressStrings.length) {
        compressStringsId = ensureIdWithPrefix("compressStrings")

        if (validCompressStrings.length > 10) {
            for (let i = 0; i < validCompressStrings.length; i++) {
                if (i === 0) {
                    writer.write(`const ${compressStringsId} = [`).indent()
                }
                writer.write(
                    `${validCompressStrings[i]},${i === validCompressStrings.length - 1 ? "" : "\n"}`
                )
            }
            writer.dedent().writeLine("]")
        } else {
            writer.writeLine(`const ${compressStringsId} = [${validCompressStrings.join(", ")}]`)
        }
    }

    // 生成 FragmentGetter 声明，若处于测试状态则附加节点选择语句
    // Generate the FragmentGetter declaration; if in test mode, append node selection statements.
    for (const fragment of fragments) {
        if (!fragment.content.length) {
            continue
        }

        let joinedContent = fragment.content.reduce((ret, cur) => {
            const info = analyzeResult.template.compressStrings[cur]
            if (!info || info.index === -1) {
                return ret + cur
            }
            return ((fragment.usedCompressString = true), ret + "/" + info.index)
        }, "")
        joinedContent = joinedContent.replaceAll("`", "\\`")

        if (inputDescriptor.options.debug) {
            joinedContent = joinedContent.replaceAll("\n", "\\n")
        }
        if (fragment.getWith) {
            fragment.getterId = fragment.getWith.getterId
        } else if (joinedContent !== " ") {
            const getterId = (fragment.getterId = ensureIdWithNumSuffix(
                "getFragment",
                ++fragmentsCount
            ))
            writer.writeLine(
                `const ${getterId} = ${internalId}.createFragmentGetter(\`${joinedContent}\`${
                    validCompressStrings.length && fragment.usedCompressString
                        ? `, ${compressStringsId}`
                        : ""
                })`
            )
        }
        if (isTesting) {
            generateFramgmentSelection(fragment, writer).wrapLine()
        }
    }
    if (!isTesting && fragments.some(fragment => fragment.content[0]?.trim())) {
        writer.wrapLine()
    }
}

export function generateFramgmentSelection(fragment: TemplateFragment, writer: CodeWriter) {
    const isTesting = process.env.VITEST === "true"
    const internalId = analyzeResult.generateIds.internal
    if (fragment.content.length !== 1 || fragment.content[0] !== " ") {
        const fragmentId = (fragment.id = ensureIdWithNumSuffix(
            "fragment",
            ++analyzeResult.fragmentIdCount
        ))
        writer.wrapLine().write(`const ${fragmentId} = ${fragment.getterId}()`)

        for (const selection of fragment.selections) {
            writer.write(
                `\nconst ${selection.id} = _.getChild(${
                    selection.parent ?? fragmentId
                }${selection.index ? `, ${selection.index}` : ""})`
            )
        }
    } else {
        if (fragment.selections.length) {
            fragment.id = fragment.selections[0].id
        } else {
            fragment.id = ensureIdWithNumSuffix("fragment", ++analyzeResult.fragmentIdCount)
        }
        writer.wrapLine().write(`const ${fragment.id} = ${internalId}.newTextNode()`)
    }
    return isTesting ? writer.wrapLine() : writer
}

function getSelectableParentNode(node: TemplateNode) {
    const isSelectableNode = (node: TemplateNode) => {
        switch (node.tag) {
            case "slot":
            case SPREAD_TAG: {
                return false
            }
            default: {
                return !node.isEmbedded && !node.componentTag
            }
        }
    }

    while (node.parent && !isSelectableNode(node.parent)) {
        node = node.parent
    }
    return node.parent
}

function getPrevHasDirectiveSibling(node: TemplateNode) {
    while (node.prev && !getTemplateNodeContext(node.prev).sortedDirectives.length) {
        node = node.prev
    }
    return node.prev
}
