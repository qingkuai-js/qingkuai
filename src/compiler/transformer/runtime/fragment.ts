import type {
    TemplateNode,
    SelectionCache,
    TemplateFragment,
    SelectionCacheItem,
    TemplateNodeContext
} from "#type-declarations/compiler"
import type { RuntimeCodeWriter } from "../writer"

import {
    omitQuoteAttrValueRE,
    atLeastOneWhitespaceRE,
    interpolatedAttrStartCharRE
} from "../../regular"
import {
    FRAGMENT_ROOT,
    FRAG_WITH_TARGET,
    FRAG_WHOLE_CONTENT,
    FRAG_LEADING_ANCHOR,
    FRAG_ORPHAN_CONTENT
} from "../../../util/shared/flags"
import {
    getTemplateNodeContext,
    getGeneratedStaticTextContent
} from "../../../util/compiler/template"
import { getLastElem } from "../../../util/shared/arrays"
import { ensureIdWithNumSuffix } from "../../../util/compiler/sundry"
import { newCleanObj, traverseObject } from "../../../util/shared/sundry"
import { analyzeResult, generateIdentifier, inputDescriptor } from "../../state"
import { CREATE_ANCHOR_DIRECTIVES, FRAG_FLAG_INTERPRETIVE_MAP, SPREAD_TAG } from "../../constants"

export function getTemplateFragments(nodes: TemplateNode[]) {
    if (!nodes.length) {
        return []
    }

    const fragments: TemplateFragment[] = []
    const existingFragmentContentMap: Record<string, TemplateFragment> = newCleanObj()

    function extendFragments(nodeContext: TemplateNodeContext | null) {
        const fragment: TemplateFragment = {
            id: "",
            flag: 0,
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
                replaceWithText: getLastElem(fragment.content)?.value === "<!>",
                index: (parentContext?.selectableChildCount ?? fragment.directChildrenCount) - 1
            })
            if (nodeContext) {
                nodeContext.id = nodeId
            }
            return nodeId
        }

        for (const node of nodes) {
            if (node.isEmbedded) {
                continue
            }

            const isComment = "!" === node.tag
            const nodeContext = getTemplateNodeContext(node)

            const addEmptyTextNodeContent = (select = false) => {
                if (getLastElem(fragment.content)?.isText) {
                    fragment.content.push({
                        isText: false,
                        value: "<!>"
                    })
                } else {
                    fragment.content.push({
                        isText: true,
                        value: " "
                    })
                }
                increaseDirectChildrenCount()
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
                const selectableParent =
                    fragment.nodeContext === nodeContext ? null : getSelectableParentNode(node)
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
                        const lastContent = getLastElem(fragment.content)
                        if (lastContent?.isText) {
                            selectLastNode("text")
                            lastContent.value = "<!>"
                            lastContent.isText = false
                            getLastElem(fragment.selections)!.replaceWithText = true
                        }
                        fragment.content.push({
                            isText: true,
                            value: content
                        })
                        increaseDirectChildrenCount()
                    }
                }
                continue
            }

            if (isComment) {
                fragment.content.push({
                    isText: false,
                    value: "<!--"
                })
            } else {
                fragment.content.push({
                    isText: false,
                    value: `<${node.tag}`
                })
            }

            for (const attribute of node.attributes) {
                const rawName = attribute.name.raw
                const rawValue = attribute.value.raw
                const isStaticClass = rawName === "class"
                if (
                    !interpolatedAttrStartCharRE.test(rawName[0]) &&
                    (!isStaticClass || !nodeContext.attributesMap["!class"])
                ) {
                    fragment.content.push({
                        isText: false,
                        value: " "
                    })
                    fragment.content.push({
                        isText: false,
                        value: rawName
                    })

                    if (attribute.equalSign) {
                        const quote = attribute.valueEnclosure === "double" ? '"' : "'"
                        const couldOmitQuote = omitQuoteAttrValueRE.test(rawValue)
                        fragment.content.push({
                            isText: false,
                            value: "="
                        })

                        if (!couldOmitQuote) {
                            fragment.content.push({
                                isText: false,
                                value: quote
                            })
                        }
                        if (isStaticClass) {
                            const className = rawValue.replaceAll(atLeastOneWhitespaceRE, " ")
                            const classList = className.trim().split(" ")
                            for (let i = 0; i < classList.length; i++) {
                                if (classList[i]) {
                                    fragment.content.push({
                                        isText: false,
                                        value: classList[i]
                                    })
                                }
                                if (i !== classList.length - 1) {
                                    fragment.content.push({
                                        isText: false,
                                        value: " "
                                    })
                                }
                            }
                        } else {
                            fragment.content.push({
                                isText: false,
                                value: rawValue
                            })
                        }
                        if (!couldOmitQuote) {
                            fragment.content.push({
                                isText: false,
                                value: quote
                            })
                        }
                    }
                }
            }
            if (inputDescriptor.styles.length) {
                fragment.content.push({
                    isText: false,
                    value: ` qk-${inputDescriptor.options.hashId}`
                })
            }
            if (!isComment) {
                fragment.content.push({
                    isText: false,
                    value: ">"
                })
            }
            if ((increaseDirectChildrenCount(), nodeContext.shouldBeSelected)) {
                selectLastNode(node.tag, nodeContext)
            }
            generate(node.children, fragment, nodeContext)

            if (!node.isSelfClosing) {
                fragment.content.push({
                    isText: false,
                    value: isComment ? "-->" : `</${node.tag}>`
                })
            }
        }
    })(nodes, extendFragments(null), null)

    for (const fragment of fragments) {
        const joinedContent = fragment.content.map(item => item.value).join("")
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
            const compressStringsId = generateIdentifier.compressStrings
            const fragmentGetterId = ensureIdWithNumSuffix("_getFragment")
            const joinedContent = fragment.content.map(item => item.value).join("")
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
    const flagInterpretives: string[] = []
    const selectionCache: SelectionCache = newCleanObj()
    if (!fragment.nodeContext || !fragment.nodeContext.node.hasActualAncestor) {
        fragment.flag |= FRAGMENT_ROOT
    }
    if (isFragmentWholeContent(fragment)) {
        fragment.flag |= FRAG_WHOLE_CONTENT
    }
    if (doesFragmentNeedLeadingAnchor(fragment)) {
        fragment.flag |= FRAG_LEADING_ANCHOR
    } else if (isFragmentOrphan(fragment)) {
        fragment.flag |= FRAG_ORPHAN_CONTENT
        fragment.id = fragment.selections[0]?.id ?? ""
    }
    if (doesFragmentHasTargetDirective(fragment)) {
        fragment.flag |= FRAG_WITH_TARGET
    }
    if (!fragment.id) {
        fragment.id = ensureIdWithNumSuffix("_fragment")
    }
    traverseObject(FRAG_FLAG_INTERPRETIVE_MAP, (flag, interpret) => {
        if (fragment.flag & flag) {
            flagInterpretives.push(interpret)
        }
    })

    const internalId = generateIdentifier.internal
    const interpretiveComment =
        fragment.flag && inputDescriptor.options.interpretiveComments
            ? `/* ${flagInterpretives.join(" | ")} */ `
            : ""
    writer.wrapLine().write(`const ${fragment.id} = ${fragment.getterId}(`)
    writer.write(`${fragment.flag ? `${interpretiveComment}${fragment.flag}` : ""})`)

    for (const selection of fragment.selections) {
        if (fragment.flag & FRAG_ORPHAN_CONTENT && selection === fragment.selections[0]) {
            continue
        }

        const index = selection.index ?? 0
        const parentId = selection.parent ?? fragment.id
        const methodSuffis = selection.replaceWithText ? "AsText" : ""
        let selectExpression = `${internalId}.getChild${methodSuffis}(${parentId}`
        if (index) {
            const sameParentSelections = selectionCache[parentId]
            if (sameParentSelections?.length) {
                let closest: SelectionCacheItem | null = null
                for (let i = sameParentSelections.length - 1; i >= 0; i--) {
                    const item = sameParentSelections[i]
                    if (item.index <= index) {
                        closest = item
                        break
                    }
                }
                if (closest) {
                    const distance = index - closest.index
                    if (distance) {
                        const getSiblingMethod = `getSibling${methodSuffis}`
                        selectExpression =
                            `${internalId}.${getSiblingMethod}` +
                            `(${closest.id}${distance > 1 ? `, ${distance}` : ""})`
                    }
                } else {
                    selectExpression += `, ${index}`
                }
            } else {
                selectExpression += `, ${index}`
            }
        }
        if (selectExpression.startsWith(`${internalId}.getChild`)) {
            selectExpression += ")"
        }

        writer.wrapLine().write(`const ${selection.id} = ${selectExpression}`)
        ;(selectionCache[parentId] ??= []).push({
            id: selection.id,
            index
        })
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

function doesFragmentHasTargetDirective(fragment: TemplateFragment) {
    return fragment.nodeContext?.sortedDirectives.some(directive => {
        return directive.name.raw === "#target"
    })
}

function doesFragmentNeedLeadingAnchor(fragment: TemplateFragment) {
    const nodeContext = fragment.nodeContext
    if (!nodeContext) {
        for (const [, nodeContext] of analyzeResult.template.nodeContexts) {
            if (nodeContext.fragment) {
                return !!(nodeContext.node.componentTag || nodeContext.node.tag === SPREAD_TAG)
            }
        }
        return false
    }
    return nodeContext.node.children.some(child => {
        if (child.componentTag || child.tag === SPREAD_TAG) {
            return true
        }

        const childContext = getTemplateNodeContext(child)
        return childContext.sortedDirectives.some(directive => {
            return directive.name.raw !== "#slot"
        })
    })
}

function isFragmentOrphan(fragment: TemplateFragment) {
    if (
        fragment.flag & FRAG_LEADING_ANCHOR ||
        fragment.directChildrenCount !== 1 ||
        fragment.content[0].value === " "
    ) {
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
