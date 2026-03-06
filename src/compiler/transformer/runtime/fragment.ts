import type {
    TemplateNode,
    TemplateFragment,
    TemplateNodeContext
} from "#type-declarations/compiler"
import type { CodeWriter } from "../writer"

import {
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
import { CREATE_ANCHOR_DIRECTIVES, SPREAD_TAG } from "../../constants"
import { newCleanObj, traverseObject } from "../../../util/shared/sundry"
import { analyzeResult, generateIdentifier, inputDescriptor } from "../../state"
import { interpolatedAttrStartCharRE, omitQuoteAttrValueRE } from "../../regular"

export function getTemplateFragments(nodes: TemplateNode[]) {
    if (!nodes.length) {
        return []
    }

    const fragments: TemplateFragment[] = []
    const existingFragmentContentMap: Record<string, TemplateFragment> = newCleanObj()

    function extendFragments(nodeContext: TemplateNodeContext | null) {
        const fragment: TemplateFragment = {
            id: "",
            content: [],
            getterId: "",
            selections: [],
            getWith: undefined,
            directChildrenCount: 0,
            usedCompressString: false
        }
        if ((fragments.push(fragment), nodeContext)) {
            return (nodeContext.fragment = fragment)
        } else {
            return (analyzeResult.template.componentFragment = fragment)
        }
    }

    ;(function generate(
        nodes: TemplateNode[],
        fragment: TemplateFragment,
        parentContext: TemplateNodeContext | null
    ) {
        const increaseDirectChildrenCount = () => {
            if (!parentContext) {
                fragment.directChildrenCount++
            } else {
                parentContext.selectableChildCount++
            }
        }

        const selectLastNode = (id: string, nodeContext?: TemplateNodeContext) => {
            const nodeId = ensureIdWithNumSuffix("_" + id)
            fragment.selections.push({
                id: nodeId,
                parent: parentContext?.id,
                replaceWithText: getLastElem(fragment.content) === "<!>",
                index: (parentContext?.selectableChildCount ?? fragment.directChildrenCount) - 1
            })
            return (nodeContext && (nodeContext.id = nodeId), nodeId)
        }

        for (const node of nodes) {
            if (node.isEmbedded) {
                continue
            }

            const isComment = "!" === node.tag
            const nodeContext = getTemplateNodeContext(node)

            const addEmptyTextNodeContent = (select = false) => {
                const useComment = getLastElem(fragment.content) === " "
                increaseDirectChildrenCount()
                fragment.content.push(useComment ? "<!>" : " ")
                return select ? selectLastNode("text", nodeContext) : ""
            }

            const createFragmentWithAnchor = (nodes: TemplateNode[]) => {
                const existingFragment = nodeContext.fragment ?? extendFragments(nodeContext)
                if (!node.parent?.componentTag) {
                    nodeContext.anchorId = addEmptyTextNodeContent(true)
                }
                generate(nodes, existingFragment, null)
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

            // 如果节点只具有一个 #html 指令，只需要在其内部的文本节点处创建一个锚点
            // If the node only has a `#html` directive, just create an anchor at its internal text node
            if (nodeContext.sortedDirectives.length && !nodeContext.fragment) {
                if (
                    !nodeContext.attributesMap["#html"] ||
                    nodeContext.sortedDirectives.length !== 1
                ) {
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
            }

            if (SPREAD_TAG === node.tag) {
                const selectableParent = getSelectableParentNode(node)
                generate(
                    node.children,
                    fragment,
                    selectableParent && getTemplateNodeContext(selectableParent)
                )
                continue
            }

            if ("" === node.tag) {
                if (nodeContext.shouldBeSelected) {
                    addEmptyTextNodeContent(true)
                } else {
                    const content = getGeneratedStaticTextContent(node.content[0])!
                    if (content) {
                        increaseDirectChildrenCount()
                        fragment.content.push(content)
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
            if ((increaseDirectChildrenCount(), nodeContext.shouldBeSelected)) {
                selectLastNode(node.tag, nodeContext)
            }
            generate(node.children, fragment, nodeContext)
            node.isSelfClosing || fragment.content.push(isComment ? "-->" : `</${node.tag}>`)
        }
    })(nodes, extendFragments(null), null)

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
    let compressStringsId = ""
    let hasDeclaration = false

    const validCompressStrings: string[] = []
    const internalId = generateIdentifier.internal

    traverseObject(analyzeResult.template.compressStrings, (key, value) => {
        if (value.times > 1) {
            analyzeResult.template.compressStrings[key].index = validCompressStrings.length
            validCompressStrings.push(getMaybeReusedString(key))
        }
    })

    // 生成压缩字符串数组声明
    // Generate the declaration for the compressed strings array.
    if (validCompressStrings.length) {
        compressStringsId = ensureIdWithPrefix("_compressStrings")

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

    // 生成 FragmentGetter 声明
    // Generate the FragmentGetter declaration
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
        hasDeclaration = true
        joinedContent = joinedContent.replaceAll("`", "\\`")

        if (inputDescriptor.options.debug) {
            joinedContent = joinedContent.replaceAll("\n", "\\n")
        }
        if (fragment.getWith) {
            fragment.getterId = fragment.getWith.getterId
        } else {
            const arg =
                validCompressStrings.length && fragment.usedCompressString
                    ? `, ${compressStringsId}`
                    : ""
            writer.write(`const ${(fragment.getterId = ensureIdWithNumSuffix("_getFragment"))}`)
            writer.write(` = ${internalId}.createFragmentGetter(\`${joinedContent}\`${arg})\n`)
        }
    }
    return (hasDeclaration && writer.wrapLine(), writer)
}

export function generateFramgmentSelection(fragment: TemplateFragment, writer: CodeWriter) {
    const internalId = generateIdentifier.internal
    const fragmentId = (fragment.id = ensureIdWithNumSuffix("_fragment"))
    writer.wrapLine().write(`const ${fragmentId} = ${fragment.getterId}()`)

    for (const selection of fragment.selections) {
        writer.wrapLine().write(`const ${selection.id} = `)
        writer.write(
            `${internalId}.getChild${selection.replaceWithText ? "AsText" : ""}(${
                selection.parent ?? fragmentId
            }${selection.index ? `, ${selection.index}` : ""})`
        )
        selection.replaceWithText && writer.write(")")
    }
    return writer
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
