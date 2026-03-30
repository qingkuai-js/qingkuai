import type {
    Range,
    TemplateNode,
    InputOptions,
    TextContentPart,
    ScriptDescriptor,
    TemplateAttribute,
    AttributeValueEnclosure
} from "#type-declarations/compiler"
import type { RegExpExecRet } from "#type-declarations/tools"
import type { ParseTemplateFunc } from "#type-declarations/compiler-ex"

import {
    whitespacesRE,
    equalTokenRE,
    startCurlyRE,
    startQuoteRE,
    componentTagRE,
    tagCloseCharsRE,
    preWhiteSpaceRuleRE,
    templateAttributeEndRE,
    startWithTagStructureRE,
    templateAttributeNameRE,
    templateTagStructureRE,
    templateEmbeddedLangTagRE,
    templateInvalidAttributeRE,
    interpolatedAttrStartCharRE
} from "../regular"
import {
    getPosByIndex,
    getLocByIndex,
    newASTLocation,
    newASTPosition,
    markPositionFlag,
    getRangeByLocation,
    getLocWithDefaultEnd,
    getPositionOfEachChar
} from "../../util/compiler/position"
import {
    UnexpectedToken,
    TagIsNotClosing,
    NoEndTagMatched,
    InvalidElementTagName,
    InvalidAttributeFormat,
    TagCanNotBeSelfClosing,
    EmptyInterpolationBlock,
    EmbeddedLangNotInTopLevel,
    TemplateStartsWithEndTag,
    UnclosedInterpolationBlock,
    UnclosedStaticAttributeValue,
    EmbeddedScriptBlockOutOfLimit,
    NoNameForInterpolatedAttribute,
    InvalidValueEnclosureForStaticAttribute,
    InvalidValueEnclosureForInterpolatedAttribute
} from "../message/error"
import { PositionFlag } from "../enums"
import { filterTemplateNodes } from "./filter"
import { getLastElem } from "../../util/shared/arrays"
import { objectAssign } from "../../util/shared/aliases"
import { isNull, isUndefined } from "../../util/shared/assert"
import { inputDescriptor, resetCompilerState } from "../state"
import { isValidIdentifierName } from "../../util/compiler/assert"
import { kebab2Camel, findEndBracket } from "../../util/compiler/string"
import { isNonEmptyExpression, isSelfClosingTag } from "../../util/compiler/assert"
import { ATTRIBUTE_VALUE_ENCLOSURE_MAP, PARSER_TEMPLATE_OPTIONS } from "../constants"
import { getStartTagOpenLoc, getLeadingCommentNode } from "../../util/compiler/template"

export const parseTemplateStandalone: ParseTemplateFunc = (source, options = {}) => {
    const inputOptions: Partial<InputOptions> = {}
    if (options.recover) {
        inputOptions.checkMode = true
    }
    if (isUndefined(options.preserveBlankTextNodes)) {
        options.preserveBlankTextNodes = true
    }
    if (isUndefined(options.preserveCommentNodes) || options.preserveCommentNodes) {
        inputOptions.preserveHtmlComments = true
    }
    return (resetCompilerState(inputOptions), parseTemplate(source, options))
}

export function newTemplateNode(): TemplateNode {
    return {
        tag: "",
        rawTag: "",
        next: null,
        prev: null,
        parent: null,
        content: [],
        children: [],
        attributes: [],
        componentTag: "",
        isEmbedded: false,
        isSelfClosing: false,
        preWhiteSpace: false,
        loc: newASTLocation(),
        endTagStartPos: newASTPosition(),
        startTagEndPos: newASTPosition()
    }
}

export function parseTemplate(source: string, options = PARSER_TEMPLATE_OPTIONS) {
    let index = 0
    let dps = source // dynamic programming source

    inputDescriptor.source = source
    inputDescriptor.positions = getPositionOfEachChar(source)

    const astList: TemplateNode[] = []
    const scriptDescriptor = inputDescriptor.script

    // 解析入口，递归执行解析方法
    // Parsing entry point: recursively execute the parsing process.
    for (let prev: TemplateNode | undefined = undefined; dps.length; ) {
        const textNode = parseContent(null, prev)
        if (textNode) {
            astList.push((prev = textNode))
        }

        if (dps) {
            const templateNode = parseTag(null, prev)
            if (templateNode) {
                astList.push((prev = templateNode))
            }
        }
    }

    // 过滤无效节点并返回最终的解析结果
    // Filter out invalid nodes and return the final parsing result
    return (function filterParseResult(list: TemplateNode[]) {
        return list.filter(node => {
            const shouldReserve = filterTemplateNodes(node, options)
            if (shouldReserve) {
                node.children = filterParseResult(node.children)
            } else {
                if (node.prev) {
                    node.prev.next = node.next
                }
                if (node.next) {
                    node.next.prev = node.prev
                }
            }
            return shouldReserve
        })
    })(astList)

    // 收缩 source 并修改 index，返回下次开始的位置
    // reduce souce and change index, returns the starting position for next time.
    function reduceSource(start: number) {
        index += start
        dps = dps.slice(start)
        return getPosByIndex(index)
    }

    // 将 dps 快进到非空白字符的位置，返回下次开始的位置
    // Fast-forward `dps` to the next non-whitespace character, returns the starting position for next time.
    function reduceSpaces() {
        const spacesMatched = whitespacesRE.exec(dps)
        return reduceSource(spacesMatched?.[0].length || 0)
    }

    // 找到结束标签的关闭字符>，如果遇到无意义字符（非空白及>）则报错，返回结果表示是否存在关闭字符
    // Find the closing character `>` of the end tag; throw an error if any meaningless character
    // (non-whitespace and not `>`) is encountered. The return value indicates whether the closing character exists.
    function findCloseCharOfEndTag() {
        if ((reduceSpaces(), !dps.startsWith(">"))) {
            const endCharIndex = dps.indexOf(">")
            if (endCharIndex !== -1) {
                UnexpectedToken(getLocByIndex(index, index + 1), dps[0], ">")
                return (reduceSource(endCharIndex + 1), true)
            }
            return (reduceSource(dps.length), false)
        }
        return (reduceSource(1), true)
    }

    // 解析出标签的 textContext 部分
    // Parse the textContent part of the tag.
    function parseContent(parent: TemplateNode | null, prev: TemplateNode | null = null) {
        let contentEndRE = templateTagStructureRE
        const contentStartIndex = index
        const contentParts: TextContentPart[] = []

        const extendContentParts = (part: TextContentPart) => {
            if ((contentParts.push(part), part.isInterpolated)) {
                markPositionFlag(PositionFlag.InScript, ...getRangeByLocation(part.loc))
            }
        }

        // textarea 节点都认作只有一个文本节点
        // A textarea element is treated as having only a single text node.
        if (parent?.tag === "textarea") {
            contentEndRE = new RegExp(`</${parent.tag}`)
        }

        while (dps.length) {
            const startBracketIndex = dps.indexOf("{")
            const partEndIndex = contentEndRE.exec(dps)?.index ?? dps.length
            if (startBracketIndex === -1 || startBracketIndex > partEndIndex) {
                if (partEndIndex) {
                    extendContentParts({
                        value: dps.slice(0, partEndIndex),
                        isInterpolated: false,
                        loc: getLocByIndex(index, reduceSource(partEndIndex).index)
                    })
                }
                break
            }
            if (startBracketIndex > 0) {
                extendContentParts({
                    isInterpolated: false,
                    value: dps.slice(0, startBracketIndex),
                    loc: getLocByIndex(index, reduceSource(startBracketIndex).index)
                })
            }

            const endBracketIndex = findEndBracket(dps)
            if (endBracketIndex === -1) {
                extendContentParts({
                    isInterpolated: true,
                    value: dps.slice(1),
                    loc: getLocByIndex(index + 1, reduceSource(dps.length).index - 1)
                })
                UnclosedInterpolationBlock(getLocByIndex(index + startBracketIndex))
            } else {
                extendContentParts({
                    isInterpolated: true,
                    value: dps.slice(1, endBracketIndex),
                    loc: getLocByIndex(index + 1, reduceSource(endBracketIndex + 1).index - 1)
                })
            }

            if (options.checkEmptyInterpolation) {
                const lastItem = getLastElem(contentParts)
                if (lastItem?.isInterpolated && !isNonEmptyExpression(lastItem.value)) {
                    EmptyInterpolationBlock(lastItem.loc)
                }
            }
        }

        // 内容非空时创建文本内容节点并返回
        // Create and return a text content node if the content is not empty.
        if (contentParts.length) {
            return initTemplateNode({
                prev,
                parent,
                content: contentParts,
                preWhiteSpace: !!parent?.preWhiteSpace,
                loc: getLocByIndex(contentStartIndex, index)
            })
        }
    }

    function parseTag(parent: TemplateNode | null, prev: TemplateNode | null = null) {
        // 解析注释，此时tag为!
        // Parse comment; at this point, the tag is `!`.
        while (dps.startsWith("<!--")) {
            const contentParts: TextContentPart[] = []
            const closedIndex = (reduceSource(4), dps.indexOf("-->"))
            const contentEndIndex = closedIndex === -1 ? dps.length : closedIndex
            if (closedIndex && dps) {
                contentParts.push({
                    isInterpolated: false,
                    value: dps.slice(0, contentEndIndex),
                    loc: getLocByIndex(index, index + contentEndIndex)
                })
            }

            const commentNode = initTemplateNode({
                tag: "!",
                prev,
                parent,
                preWhiteSpace: true,
                loc: getLocWithDefaultEnd(index - 4),
                startTagEndPos: getPosByIndex(index)
            })
            if (closedIndex !== -1) {
                commentNode.loc.end = reduceSource(closedIndex + 3)
                commentNode.endTagStartPos = getPosByIndex(index - 3)
            } else {
                reduceSource(contentEndIndex)
                TagIsNotClosing(getStartTagOpenLoc(commentNode), "#comment")
            }
            if (contentParts.length) {
                initTemplateNode({
                    parent: commentNode,
                    content: contentParts,
                    loc: getLocByIndex(
                        commentNode.startTagEndPos.index,
                        closedIndex === -1 ? index : commentNode.endTagStartPos.index
                    )
                })
            }
            return commentNode
        }

        let startTagOpenRange: Range
        let startTagCloseMatched: RegExpExecRet = null
        let prevForChild: TemplateNode | undefined = undefined

        const tagOpenStr = templateTagStructureRE.exec(dps)![0]
        const tagOpenLoc = getLocByIndex(
            ...(startTagOpenRange = [index, index + tagOpenStr.length])
        )

        // 检查是否以结束标签开始
        // Check whether `dps` starts with an closing tag.
        if ((reduceSource(tagOpenStr.length), tagOpenStr.startsWith("</"))) {
            TemplateStartsWithEndTag(tagOpenLoc, tagOpenStr.slice(2))

            // 检查模式下直接快进到结束标签关闭字符，以继续执行解析
            // In checking mode, fast-forward directly to the end tag's closing character to resume parsing.
            return (findCloseCharOfEndTag(), void 0)
        }

        const tag = tagOpenStr.slice(1)
        const langMatched = templateEmbeddedLangTagRE.exec(tag)
        const isComponent = !langMatched && componentTagRE.test(tag)

        // 初始化一个用于返回的 TemplateNode 节点
        // Initialize a TemplateNode to be returned.
        const templateNode = initTemplateNode({
            tag,
            prev,
            parent,
            componentTag: isComponent
                ? isValidIdentifierName(tag, true)
                    ? tag
                    : kebab2Camel(tag)
                : "",
            loc: getLocWithDefaultEnd(tagOpenLoc.start.index)
        })

        // 解析当前节点的属性列表
        // parse the attribute list of current node.
        while (reduceSpaces() && dps && !(startTagCloseMatched = tagCloseCharsRE.exec(dps))) {
            let attrValue = ""
            let endCharIndex = -1
            let valueEndIndex = -1
            let valueStartIndex = -1
            let fullValueEndIndex = -1
            let fullValueStartIndex = -1
            let valueEnclosure: AttributeValueEnclosure = "none"

            const nameStartIndex = reduceSpaces().index
            const attrNameMatched = templateAttributeNameRE.exec(dps)

            // attrNameMatched 为 null 时表示属性名称非法
            // If `attrNameMatched` is null, the attribute name is invalid.
            if (isNull(attrNameMatched)) {
                InvalidAttributeFormat(
                    getLocByIndex(
                        index,
                        reduceSource(templateInvalidAttributeRE.exec(dps)![0].length).index
                    )
                )
                continue
            }

            const attrName = attrNameMatched[0]
            const nameEndIndex = reduceSource(attrName.length).index
            const isInterpolatedAttr = interpolatedAttrStartCharRE.test(attrName[0])

            // 属性和开始标签间无空白字符时为无效标签名称
            // Tag name is invalid when there is no whitespace between the attribute and the start tag
            if (nameStartIndex === tagOpenLoc.end.index) {
                InvalidElementTagName(
                    getLocByIndex(
                        tagOpenLoc.start.index + 1,
                        tagOpenLoc.start.index + attrName.length
                    ),
                    (templateNode.rawTag = tag + attrName)
                )
                continue
            }

            // 插值属性的名长度为1时表示没有指定属性名称
            // An interpolated attribute with a name length of 1 indicates that no attribute name was specified.
            if (isInterpolatedAttr) {
                if (attrName.length === 1) {
                    NoNameForInterpolatedAttribute(
                        getLocByIndex(nameStartIndex, nameStartIndex + 1),
                        attrName
                    )
                }
            }

            // 解析属性值部分
            // Parse the attribute value.
            const equalTokenMatched = equalTokenRE.exec(dps)
            if (!isNull(equalTokenMatched)) {
                const mi = equalTokenMatched.index
                const ml = equalTokenMatched[0].length
                const equalTokenEndIndex = reduceSource(mi + ml).index

                // 当静态属性值未被引号包裹或插值属性未被花括号包裹时报错；检查模式下，之后的连续非空白字符会被解析为属性值
                // Report an error when a static attribute value is not enclosed in quotes or when an interpolated
                // attribute is not enclosed in braces; in check mode, the following consecutive non-whitespace.
                // characters will be parsed as the attribute value
                if (
                    options.checkAttributeValueEnclosure &&
                    ((isInterpolatedAttr && !startCurlyRE.test(dps)) ||
                        (!isInterpolatedAttr && !startQuoteRE.test(dps)))
                ) {
                    const endIndex = templateAttributeEndRE.exec(dps)!.index
                    const errorLoc = getLocByIndex(
                        equalTokenEndIndex,
                        equalTokenEndIndex + endIndex
                    )
                    if (!isInterpolatedAttr) {
                        InvalidValueEnclosureForStaticAttribute(errorLoc)
                    } else {
                        InvalidValueEnclosureForInterpolatedAttribute(errorLoc, attrName)
                    }
                    attrValue = dps.slice(0, endIndex)
                    valueStartIndex = fullValueStartIndex = equalTokenEndIndex
                    valueEndIndex = fullValueEndIndex = reduceSource(endIndex).index
                } else {
                    fullValueStartIndex = reduceSpaces().index
                    valueStartIndex = fullValueStartIndex + 1
                    valueEnclosure = ATTRIBUTE_VALUE_ENCLOSURE_MAP[dps[0]] ?? "none"

                    // 找到属性值结束字符的位置
                    // Find the position of the attribute value's closing character
                    if (valueEnclosure === "curly") {
                        endCharIndex = findEndBracket(dps)
                    } else {
                        endCharIndex = dps.indexOf(dps[0], 1)
                    }

                    // 当属性值的结束字符不存在（右花括号或单双引号）时报错，空插值块也要报错
                    // Report an error when closing character of the attribute value (right brace or quotes)
                    // is missing; empty interpolation expression block should also trigger an error.
                    if (endCharIndex === -1) {
                        const unclosedAttributeValueLoc = getLocByIndex(
                            fullValueStartIndex,
                            index + dps.length
                        )
                        if (!isInterpolatedAttr) {
                            UnclosedStaticAttributeValue(unclosedAttributeValueLoc)
                        } else {
                            UnclosedInterpolationBlock(unclosedAttributeValueLoc)
                        }
                    } else if (
                        valueEnclosure === "curly" &&
                        !isNonEmptyExpression(dps.slice(1, endCharIndex))
                    ) {
                        if (options.checkEmptyInterpolation) {
                            EmptyInterpolationBlock(getLocByIndex(index, index + endCharIndex + 1))
                        }
                    }

                    // 完善属性值及其位置信息的相关记录
                    // Improve the related records of the attribute value and its location.
                    if (endCharIndex === -1) {
                        attrValue = dps.slice(1)
                        reduceSource(dps.length)
                    } else {
                        valueEndIndex = index + endCharIndex
                        attrValue = dps.slice(1, endCharIndex)
                        fullValueEndIndex = reduceSource(endCharIndex + 1).index
                    }
                }
                if (isInterpolatedAttr) {
                    markPositionFlag(PositionFlag.InScript, valueStartIndex, valueEndIndex)
                }
            }

            // 将属性相关信息记录到当前节点（templateNode)
            // Record attribute-related information to the current node (templateNode).
            const attributeInfo: TemplateAttribute = {
                name: {
                    raw: attrName,
                    loc: getLocByIndex(nameStartIndex, nameEndIndex)
                },
                value: {
                    raw: attrValue,
                    loc: newASTLocation()
                },
                valueEnclosure,
                equalSign: !!equalTokenMatched,
                loc: getLocWithDefaultEnd(nameStartIndex)
            }
            markPositionFlag(
                isInterpolatedAttr
                    ? PositionFlag.isInterpolatedAttributeStart
                    : PositionFlag.IsAttributeStart,
                nameStartIndex
            )
            templateNode.attributes.push(attributeInfo)

            if (isNull(equalTokenMatched)) {
                attributeInfo.loc.end = getPosByIndex(nameEndIndex)
            }
            if (valueEndIndex !== -1) {
                attributeInfo.value.loc.end = getPosByIndex(valueEndIndex)
                attributeInfo.loc.end = getPosByIndex(fullValueEndIndex)
            }
            if (attrName === "style") {
                templateNode.preWhiteSpace ||= preWhiteSpaceRuleRE.test(attrValue)
            }
            if (valueStartIndex !== -1) {
                attributeInfo.value.loc.start = getPosByIndex(valueStartIndex)
            }

            // 嵌入脚本语言标签上的 shallow 属性需要修改 CompilerOptions.reactivityMode 为 shallow
            // The `shallow` attribute on an embedded script language tag requires setting `CompilerOptions.reactivityMode` to `shallow`.
            if (
                !isInterpolatedAttr &&
                (attrName === "shallow" || attrName === "reactive") &&
                (templateNode.tag === "lang-js" || templateNode.tag === "lang-ts")
            ) {
                inputDescriptor.options.reactivityMode = attrName
            }
        }

        // 快进到开始标签结束处，不存在闭合字符时直接返回此节点
        // Fast-forward to the end of the start tag; return this node directly if no closing character is found.
        if (isNull(startTagCloseMatched)) {
            return (TagIsNotClosing(tagOpenLoc, tag), templateNode)
        }
        templateNode.startTagEndPos = reduceSource(startTagCloseMatched[0].length)

        // 遇到 script/style 或嵌入语言标签时直接快进到结束标签的结尾
        // Fast-forward to the end of the end tag when encountering a script/style or embedded language tag.
        if (langMatched || tag === "script" || tag === "style") {
            const endTagIndex = new RegExp("</" + tag).exec(dps)?.index ?? -1
            const embeddedLang = langMatched?.[1] || ""
            const neverOver = endTagIndex === -1
            if (neverOver) {
                TagIsNotClosing(tagOpenLoc, tag)
            }

            // 如果没有匹配到结束标签，整个 dps 都被认为是当前标签的内容
            // If no end tag is matched, the entire `dps` is treated as the content of the current tag.
            const endTagSourceIndex = neverOver ? -1 : index + endTagIndex
            const rawContent = dps.slice(0, neverOver ? undefined : endTagIndex)
            reduceSource(neverOver ? dps.length : endTagIndex + tag.length + 2)
            templateNode.isEmbedded = !!embeddedLang

            // 检查结束标签是否闭合，并记录当前节点的相关位置信息
            // Check whether the end tag is properly closed and record the relevant position info of the current node.
            if (!neverOver) {
                const endTagOpenLoc = getLocByIndex(endTagSourceIndex, index)
                if (findCloseCharOfEndTag()) {
                    templateNode.loc.end = getPosByIndex(index)
                } else {
                    TagIsNotClosing(endTagOpenLoc, tag, true)
                }
                templateNode.endTagStartPos = endTagOpenLoc.start
            }

            const contentLoc = {
                start: templateNode.startTagEndPos,
                end: templateNode.endTagStartPos
            }

            if (((templateNode.preWhiteSpace = true), rawContent)) {
                initTemplateNode({
                    content: [
                        {
                            loc: contentLoc,
                            value: rawContent,
                            isInterpolated: false
                        }
                    ],
                    loc: contentLoc,
                    parent: templateNode
                })
            }

            // script 或 style 标签时直接返回节点
            // Return the node directly if it's a script or style tag.
            if (!embeddedLang) {
                return templateNode
            }

            // 嵌入语言标签只能出现在模板顶层
            // Embedded language tags can only appear at the top level of the template.
            if (!isNull(templateNode.parent)) {
                EmbeddedLangNotInTopLevel(tagOpenLoc, tag)
            }

            // 记录嵌入样式/脚本语言块的相关信息
            // Record relevant information of embedded style/script blocks.
            if (embeddedLang === "js" || embeddedLang === "ts") {
                if (scriptDescriptor.existing) {
                    EmbeddedScriptBlockOutOfLimit(tagOpenLoc)
                    return templateNode
                }

                markPositionFlag(
                    PositionFlag.InScript,
                    contentLoc.start.index,
                    contentLoc.end.index
                )
                objectAssign<ScriptDescriptor, ScriptDescriptor>(scriptDescriptor, {
                    startTagOpenRange,
                    existing: true,
                    loc: contentLoc,
                    code: rawContent,
                    isTS: embeddedLang === "ts",
                    lineCount: contentLoc.end.line - contentLoc.start.line + 1
                })
            } else {
                inputDescriptor.styles.push({
                    startTagOpenRange,
                    loc: contentLoc,
                    code: rawContent,
                    lang: embeddedLang
                })
                markPositionFlag(PositionFlag.InStyle, contentLoc.start.index, contentLoc.end.index)
            }
            return templateNode
        }

        // 自闭合标签或组件开始标签以 /> 结尾时，无需解析子节点，其他情况解析文本内容和子节点
        // when tag is self-closing tag or a component start tag end in `/>`, there is no
        // need to parse child nodes, otherwise, the content and child nodes should be parsed.
        if (!isSelfClosingTag(tag) && !startTagCloseMatched[0].startsWith("/")) {
            while (true) {
                const endtagStartIndex = index
                const endTagMatched = new RegExp(`^</${tag}`).exec(dps)
                if (endTagMatched) {
                    reduceSource(endTagMatched[0].length)
                    templateNode.endTagStartPos = getPosByIndex(endtagStartIndex)

                    if (findCloseCharOfEndTag()) {
                        templateNode.loc.end = getPosByIndex(index)
                    } else {
                        const endTagOpenLoc = getLocByIndex(
                            endtagStartIndex,
                            endtagStartIndex + tag.length + 2
                        )
                        TagIsNotClosing(endTagOpenLoc, tag, true)
                    }
                    return templateNode
                }

                if (!dps) {
                    NoEndTagMatched(tagOpenLoc, tag)
                    return templateNode
                }

                // 继续递归解析 textContent 或子标签
                // Continue recursively parsing `textContent` or child tags.
                if (startWithTagStructureRE.test(dps)) {
                    prevForChild = parseTag(templateNode, prevForChild)
                } else {
                    prevForChild = parseContent(templateNode, prevForChild)
                }
            }
        } else if (isSelfClosingTag(tag) || isComponent) {
            templateNode.isSelfClosing = true
            templateNode.loc.end = getPosByIndex(index)
        } else {
            TagCanNotBeSelfClosing(getLocByIndex(index - 2, index), tag)
        }
        return templateNode
    }

    // 初始化一个模板语法树节点
    // Initialize a AST node for template.
    function initTemplateNode(options: Partial<TemplateNode> = {}): TemplateNode {
        const templateNode = Object.assign(newTemplateNode(), {
            ...options,
            rawTag: options.tag
        })
        if (options.prev) {
            options.prev.next = templateNode
        }
        if (options.tag === "pre" || options.parent?.preWhiteSpace) {
            templateNode.preWhiteSpace = true
        }
        if (options.tag) {
            templateNode.isSelfClosing = isSelfClosingTag(options.tag)
        }
        if (!templateNode.preWhiteSpace) {
            templateNode.preWhiteSpace = preWhiteSpaceRuleRE.test(
                getLeadingCommentNode(templateNode)?.children[0]?.content[0]?.value ?? ""
            )
        }
        if (options.componentTag && options.loc) {
            markPositionFlag(PositionFlag.IsComponentStart, options.loc.start.index)
        }
        return (options.parent?.children.push(templateNode), templateNode)
    }
}
