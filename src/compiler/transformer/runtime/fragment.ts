import type {
    TemplateNode,
    TemplateFragment,
    TemplateNodeContext
} from "#type-declarations/compiler"
import type { RuntimeCodeWriter } from "../writer"

import {
    omitQuoteAttrValueRE,
    atLeastOneWhitespaceRE,
    interpolatedAttrStartCharRE
} from "../../regular"
import {
    getTemplateNodeContext,
    getGeneratedStaticTextContent
} from "../../../util/compiler/template"
import { getLastElem } from "../../../util/shared/arrays"
import { newCleanObj } from "../../../util/shared/sundry"
import { ensureIdWithNumSuffix } from "../../../util/compiler/sundry"
import { CREATE_ANCHOR_DIRECTIVES, SPREAD_TAG } from "../../constants"
import { analyzeResult, generateIdentifier, inputDescriptor } from "../../state"
import {
    FRAG_LEADING_ANCHOR,
    FRAG_ORPHAN_CONTENT,
    FRAG_WHOLE_CONTENT
} from "../../../util/shared/flags"

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
            nodeContext,
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
                const isStaticClass = rawName === "class"
                if (
                    !interpolatedAttrStartCharRE.test(rawName[0]) &&
                    (!isStaticClass || !nodeContext.attributesMap["!class"])
                ) {
                    fragment.content.push(" ")
                    fragment.content.push(rawName)

                    if (attribute.equalSign) {
                        const quote = attribute.valueEnclosure === "double" ? '"' : "'"
                        const couldOmitQuote = omitQuoteAttrValueRE.test(rawValue)
                        fragment.content.push("=")

                        if (!couldOmitQuote) {
                            fragment.content.push(quote)
                        }
                        if (isStaticClass) {
                            const className = rawValue.replaceAll(atLeastOneWhitespaceRE, " ")
                            const classList = className.trim().split(" ")
                            for (let i = 0; i < classList.length; i++) {
                                if (classList[i]) {
                                    fragment.content.push(classList[i])
                                }
                                if (i !== classList.length - 1) {
                                    fragment.content.push(" ")
                                }
                            }
                        } else {
                            fragment.content.push(rawValue)
                        }
                        if (!couldOmitQuote) {
                            fragment.content.push(quote)
                        }
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

            if (!node.isSelfClosing) {
                fragment.content.push(isComment ? "-->" : `</${node.tag}>`)
            }
        }
    })(nodes, extendFragments(null), null)

    for (const fragment of fragments) {
        const joinedContent = fragment.content.join("")
        const existingFragment = existingFragmentContentMap[joinedContent]
        if (existingFragment) {
            fragment.getWith = existingFragment
        } else {
            existingFragmentContentMap[joinedContent] = fragment
        }
    }
    return fragments
}

export function writeFragmentGetterDeclarations(
    writer: RuntimeCodeWriter,
    fragments: TemplateFragment[]
) {
    let hasFragmentGetterDeclaration = false
    for (const fragment of fragments) {
        if (!fragment.content.length) {
            continue
        }
        if (fragment.getWith) {
            fragment.getterId = fragment.getWith!.getterId
        } else {
            const internalId = generateIdentifier.internal
            const joinedContent = fragment.content.join("")
            const compressStringsId = generateIdentifier.compressStrings
            const fragmentGetterId = ensureIdWithNumSuffix("_getFragment")
            fragment.getterId = fragmentGetterId
            writer.write(`const ${fragmentGetterId} = `)
            writer.write(`${internalId}.createFragmentGetter(`)

            let stringifiedContent = `\`${joinedContent.replaceAll("`", "\\`")}\``
            if (inputDescriptor.options.debug) {
                stringifiedContent = stringifiedContent.replaceAll("\n", "\\n")
            }
            writer.write(stringifiedContent)

            if (fragment.usedCompressString) {
                writer.write(`, ${compressStringsId}`)
            }
            writer.writeLine(")")
            hasFragmentGetterDeclaration = true
        }
    }
    if (hasFragmentGetterDeclaration) {
        writer.wrapLine()
    }
    return writer
}

export function writeFragmentSelections(writer: RuntimeCodeWriter, fragment: TemplateFragment) {
    let isOrphan = false
    let fragmentFlag = 0
    const flagInterpretive: string[] = []
    if (isFragmentWholeContent(fragment)) {
        fragmentFlag |= FRAG_WHOLE_CONTENT
        flagInterpretive.push("WHOLE_CONTENT")
    }
    if (isFragmentNeedLeadingAnchor(fragment)) {
        fragmentFlag |= FRAG_LEADING_ANCHOR
        flagInterpretive.push("LEADING_ANCHOR")
    } else if (isFragmentOrphan(fragment)) {
        isOrphan = true
        fragmentFlag |= FRAG_ORPHAN_CONTENT
        flagInterpretive.push("ORPHAN_CONTENT")
        fragment.id = fragment.selections[0]?.id ?? ""
    }
    if (!fragment.id) {
        fragment.id = ensureIdWithNumSuffix("_fragment")
    }
    const internalId = generateIdentifier.internal
    const interpretiveComment =
        fragmentFlag && inputDescriptor.options.interpretiveComments
            ? `/* ${flagInterpretive.join(" | ")} */ `
            : ""
    writer.wrapLine().write(`const ${fragment.id} = ${fragment.getterId}(`)
    writer.write(`${fragmentFlag ? `${interpretiveComment}${fragmentFlag}` : ""})`)

    for (const selection of fragment.selections) {
        if (isOrphan && selection === fragment.selections[0]) {
            continue
        }
        writer.wrapLine().write(`const ${selection.id} = `)
        writer.write(
            `${internalId}.getChild${selection.replaceWithText ? "AsText" : ""}(${
                selection.parent ?? fragment.id
            }${selection.index ? `, ${selection.index}` : ""})`
        )
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

function isFragmentWholeContent(fragment: TemplateFragment) {
    const nodeContext = fragment.nodeContext
    if (!nodeContext?.node.parent) {
        return false
    }

    for (const sibling of nodeContext.node.parent.children) {
        const siblingContext = getTemplateNodeContext(sibling)
        if (siblingContext === nodeContext) {
            continue
        }
        if (siblingContext.fragment) {
            return false
        }
        switch (sibling.tag) {
            case "slot": {
                return false
            }
            case SPREAD_TAG: {
                return false
            }
        }
    }
    return true
}

function isFragmentNeedLeadingAnchor(fragment: TemplateFragment) {
    const nodeContext = fragment.nodeContext
    if (!nodeContext) {
        return false
    }
    return nodeContext.node.children.some(child => {
        if (child.tag === SPREAD_TAG) {
            return true
        }

        const childContext = getTemplateNodeContext(child)
        return childContext.sortedDirectives.some(directive => {
            return directive.name.raw !== "#slot"
        })
    })
}

function isFragmentOrphan(fragment: TemplateFragment) {
    if (isFragmentNeedLeadingAnchor(fragment) || fragment.directChildrenCount !== 1) {
        return false
    }
    if (fragment !== analyzeResult.template.componentFragment) {
        return true
    }

    const rootAnchorId = fragment.selections[0]?.id
    if (!rootAnchorId) {
        return true
    }
    for (const nodeContext of analyzeResult.template.nodeContexts.values()) {
        if (nodeContext.anchorId === rootAnchorId) {
            return false
        }
    }
    return true
}
