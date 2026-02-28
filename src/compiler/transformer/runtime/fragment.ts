import type {
    TemplateNode,
    TemplateFragment,
    TemplateNodeContext
} from "#type-declarations/compiler"
import type { CodeWriter } from "../writer"

import { stringify } from "../../../util/shared/aliases"
import { isUndefined } from "../../../util/shared/assert"
import { analyzeResult, inputDescriptor } from "../../state"
import { CREATE_ANCHOR_DIRECTIVES, SPREAD_TAG } from "../../constants"
import { getLastElem, getLastIndex } from "../../../util/shared/arrays"
import { any, newCleanObj, traverseObject } from "../../../util/shared/sundry"
import { interpolatedAttrStartCharRE, omitQuoteAttrValueRE } from "../../regular"
import { ensureIdWithNumSuffix, ensureIdWithPrefix } from "../../../util/compiler/sundry"
import { isSelectableNode, willTextNodeGenerateFragment } from "../../../util/compiler/template"

export function generateTemplateFragments(nodes: TemplateNode[], writer: CodeWriter) {
    let hashIdSetCount = 0
    let commentAnchorCount = 0

    const fragments: TemplateFragment[] = []
    const validCompressStrings: string[] = []
    const directChildrenCountStack: number[] = [0]
    const { internal: internalId } = analyzeResult.generateIds
    const nodeIdCountMap: Record<string, number> = newCleanObj()
    const compressStringsMap: Record<string, number> = newCleanObj()
    const { debug: isDebugMode, checkMode: isCheckMode } = inputDescriptor.options
    const { nodeContexts, staticTextContents, compressStrings } = analyzeResult.template

    if (!isDebugMode && !isCheckMode) {
        if (inputDescriptor.styles.length) {
            compressStrings[` qk-${inputDescriptor.options.hashId}`] = {
                id: "",
                times: 2
            }
        }
        compressStrings["<!>"] = {
            id: "",
            times: 2
        }
    }

    traverseObject(compressStrings, (key, value) => {
        if (value.times > 1) {
            compressStringsMap[key] = validCompressStrings.length
            validCompressStrings.push(analyzeResult.reusedStrings[key]?.id || stringify(key))
        }
    })

    function increaseDirectChildrenCount() {
        directChildrenCountStack[getLastIndex(directChildrenCountStack)]++
    }

    function createTemplateFragment() {
        const fragmentIdStart = fragments.length
        const id = ensureIdWithNumSuffix("fragment", fragmentIdStart)
        const getterId = ensureIdWithNumSuffix("getFragment", fragmentIdStart)
        const fragment: TemplateFragment = {
            id,
            getterId,
            content: "",
            usedCompressString: false,
            statements: [`const ${id} = ${getterId}()`]
        }
        return (directChildrenCountStack.push(0), fragments.push(fragment), fragment)
    }

    ;(function generate(
        nodes: TemplateNode[],
        parent: TemplateNode | null,
        fragment: TemplateFragment,
        couldCreateFragment = true
    ) {
        const selectLastNode = (id: string, nodeContext?: TemplateNodeContext) => {
            const nodeIdStart = (nodeIdCountMap[id] ??= 1)
            const nodeId = ensureIdWithNumSuffix(id, nodeIdStart)
            if ((nodeIdCountMap[id]++, nodeContext)) {
                nodeContext.id = nodeId
                nodeContext.fragment = fragment
            }
            if (!fragment.statements.length) {
                fragment.statements.push(`const ${fragment.id} = ${fragment.getterId}()`)
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
                fragment.usedCompressString ||= true
                fragment.content += "/" + compressStringsMap[str]
            }
        }

        for (const node of nodes) {
            if (node.isEmbedded) {
                continue
            }

            const isComment = "!" === node.tag
            const nodeContext = nodeContexts.get(node)!
            const shouldCreateAnchor = couldCreateFragment && shouldNodeCrateFragmentAnchor(node)

            const createFragmentWithAnchor = (nodes: TemplateNode[]) => {
                let needAnchor = false
                let createByDirective = false
                if ("slot" === node.tag || node.componentTag) {
                    needAnchor = true
                } else {
                    needAnchor = CREATE_ANCHOR_DIRECTIVES.has(
                        nodeContext.sortedDirectives[0]?.name.raw ?? ""
                    )
                    createByDirective = true
                }
                if (!needAnchor) {
                    if (createByDirective) {
                        nodeContext.anchorId = nodeContexts.get(
                            getPrevHasDirectiveSibling(node)!
                        )!.anchorId
                    }
                } else {
                    const useComment = fragment.content.endsWith(" ")
                    extendFragmentContent(useComment ? "<!>" : " ")
                    nodeContext.anchorId = selectLastNode("text")
                    useComment && commentAnchorCount++
                    increaseDirectChildrenCount()
                }
                if (nodes.length) {
                    generate(nodes, null, createTemplateFragment(), !createByDirective)
                }
            }

            if ("slot" === node.tag) {
                const children = isSpreadOrSlotTagHasContent(node) ? node.children : []
                if (shouldCreateAnchor) {
                    createFragmentWithAnchor(children)
                } else {
                    generate(
                        children,
                        null,
                        node.parent?.componentTag ? fragment : createTemplateFragment()
                    )
                }
                continue
            }

            if (node.componentTag) {
                if (shouldCreateAnchor) {
                    createFragmentWithAnchor([])
                }
                for (const child of node.children) {
                    if (shouldCreateSlotFragment(child)) {
                        generate([child], null, createTemplateFragment(), false)
                    }
                }
                continue
            }

            if (shouldCreateAnchor && shouldNodeCreateDirectiveFragment(node)) {
                createFragmentWithAnchor([node])
                continue
            }

            if (SPREAD_TAG === node.tag) {
                generate(node.children, getSelectableParentNode(node), fragment)
                continue
            }

            if (node.hasInterpolation) {
                selectLastNode(node.tag || "text", nodeContext)
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

            if (isComment) {
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
                hashIdSetCount++
                extendFragmentContent(` qk-${inputDescriptor.options.hashId}`)
            }
            if (!isComment) {
                extendFragmentContent(">")
            }
            increaseDirectChildrenCount()
            directChildrenCountStack.push(0)
            generate(node.children, node, fragment)
            node.isSelfClosing || extendFragmentContent(isComment ? "-->" : `</${node.tag}>`)
        }
        directChildrenCountStack.pop()
    })(nodes, null, createTemplateFragment())

    // 未使用注释锚点或哈希id属性时移除对应的压缩字符串
    // Remove the corresponding compressed string if comment anchors or hash id attributes are not used.
    if (!commentAnchorCount) {
        validCompressStrings.splice(validCompressStrings.length - 1, 1)
    }
    if (!hashIdSetCount && inputDescriptor.styles.length) {
        validCompressStrings.splice(validCompressStrings.length - 2, 1)
    }

    // 生成压缩字符串数组声明
    // Generate the declaration for the compressed strings array.
    const isTesting = any(import.meta).env?.VITEST
    const hasCompressStrings = validCompressStrings.length > 0
    const compressStringsId = hasCompressStrings ? ensureIdWithPrefix("compressStrings") : ""
    if (hasCompressStrings) {
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
    for (let i = 0, stringifiedContent: string; i < fragments.length; i++) {
        if (!i && !fragments[i].content) {
            continue
        }

        const { content, getterId, statements, usedCompressString } = fragments[i]
        if (((stringifiedContent = content.replaceAll("`", "\\`")), isDebugMode)) {
            stringifiedContent = stringifiedContent.replaceAll("\n", "\\n")
        }
        writer.writeLine(
            `const ${getterId} = ${internalId}.createFragmentGetter(\`${stringifiedContent}\`${
                hasCompressStrings && usedCompressString ? `, ${compressStringsId}` : ""
            })`
        )

        if (isTesting) {
            for (const statement of statements) {
                writer.writeLine(statement)
            }
            writer.wrapLine()
        }
    }
    if (!isTesting && !(fragments.length === 1 && !fragments[0].content)) {
        writer.wrapLine()
    }
}

function getSelectableParentNode(node: TemplateNode) {
    while (node.parent && !isSelectableNode(node.parent)) {
        node = node.parent
    }
    return node.parent
}

function isSpreadOrSlotTagHasContent(node: TemplateNode): boolean {
    if (!node.children.length) {
        return false
    }
    return node.children.some(child => {
        switch (child.tag) {
            case "slot":
            case SPREAD_TAG: {
                return isSpreadOrSlotTagHasContent(child)
            }
            case "": {
                return willTextNodeGenerateFragment(child)
            }
            default: {
                return !child.componentTag
            }
        }
    })
}

function shouldNodeCreateDirectiveFragment(node: TemplateNode) {
    const { nodeContexts } = analyzeResult.template
    const nodeContext = nodeContexts.get(node)!
    if (!nodeContext.sortedDirectives.length) {
        return false
    }
    switch (node.tag) {
        case "slot":
        case SPREAD_TAG: {
            return isSpreadOrSlotTagHasContent(node)
        }
        default: {
            return true
        }
    }
}

function shouldCreateSlotFragment(node: TemplateNode) {
    switch (node.tag) {
        case "slot":
        case SPREAD_TAG: {
            return isSpreadOrSlotTagHasContent(node)
        }
        case "": {
            return willTextNodeGenerateFragment(node)
        }
        default: {
            return !node.componentTag
        }
    }
}

function getPrevHasDirectiveSibling(node: TemplateNode) {
    const { nodeContexts } = analyzeResult.template
    while (node.prev && !nodeContexts.get(node.prev)?.sortedDirectives.length) {
        node = node.prev
    }
    return node.prev
}

function shouldNodeCrateFragmentAnchor(node: TemplateNode) {
    for (let current = node; current.parent; current = current.parent) {
        if (SPREAD_TAG !== current.parent.tag) {
            return true
        }
        if (shouldNodeCreateDirectiveFragment(current.parent)) {
            const { nodeContexts } = analyzeResult.template
            const nodeContext = nodeContexts.get(node)!
            const targetNodeContext = nodeContexts.get(current.parent)!
            return ((nodeContext.anchorId = targetNodeContext.anchorId), false)
        }
    }
    return true
}
