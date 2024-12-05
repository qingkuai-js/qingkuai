import type { ASTPosition, TemplateNode, RegExpExecRet, TemplateAttribute } from "../types"

import {
    tagIsComponentRE,
    templateCloseCharsRE,
    templateTagStructureRE,
    templateEmbeddedLangTag,
    templateAttributeNameRE,
    startWithTagStructureRE,
    templateConditionalCommentRE,
    templateInvalidAttributeNameRE
} from "../regular"
import {
    NoEndTagMatched,
    UnexpectedToken,
    TagIsNotClosing,
    EmbeddedLangNotInTopScope,
    TagCanNotBeSelfClosing,
    EmptyInterpolationAttrName,
    TemplateStartsWithEndTag,
    UnclosedNormalAttributeValue,
    AttributeValueIsNotQuoted,
    EmptyInterpolationExpression,
    EmbeddedScriptBlockOutOfLimit,
    UnclosedInterpolationExpression,
    NoBracketForAttributeInterpolation
} from "../message/error"
import { inputDescriptor, newScriptDescriptor } from "../state"
import { AttributeForEndTag } from "../message/warn"
import { replaceEachItems } from "../../util/shared/sundry"
import { selfClosingTags, specialTags } from "../constants"
import { isEmptyString, isNull } from "../../util/shared/assert"
import { newASTLocation, newASTPosition } from "../../util/compiler/structure"
import { getPositionOfEachChar, markPositionFlag } from "../../util/compiler/sundry"
import { findEndCurlyBracket, findOutOfSC, kebab2Camel } from "../../util/compiler/strings"
import { getLocByIndex, getLocWithDefaultEnd, getPosByIndex } from "../../util/compiler/locations"

// 这里采用嵌套函数的方式主要是为了共享index、source等变量，并在解析完成后自动清理
// 第二个参数表示是否为外部独立调用（如语言服务器的emmt功能，prettier插件的代码整理等）
export function parseTemplate(source: string, standalone = false) {
    let index = 0

    const astList: TemplateNode[] = []
    const sourceLength = source.length
    const scriptDescriptor = newScriptDescriptor()
    const positions = getPositionOfEachChar(source)
    const reserveAllComment = inputDescriptor.options.reserveTemplateComment

    // 独立调用时不要修改编译器内部状态
    if (!standalone) {
        inputDescriptor.positions = positions
        inputDescriptor.script = scriptDescriptor
    }

    // 收缩source并修改index，并返回下次开始的位置
    // reduce souce and change index
    function reduceSource(start: number) {
        index += start
        source = source.slice(start)
        return positions[index]
    }

    // 快进到非空白字符的位置，返回下次开始的位置
    function reduceSpaces() {
        const spacesMatched = /\s*/.exec(source)
        return reduceSource(spacesMatched?.[0].length || 0)
    }

    // 找到结束标签的关闭字符>，如果遇到无意义字符则发出警告（结束标签会忽略任何属性）
    function findCloseCharOfEndTag() {
        const uselessMatched = (reduceSpaces(), /[^>\s]*/.exec(source))
        const uselessLen = uselessMatched?.[0].length || 0
        if (uselessLen) {
            AttributeForEndTag(index, index + uselessLen)
        }
        reduceSpaces()
        reduceSource(uselessLen)

        const found = source.startsWith(">")
        return found && reduceSource(1), found
    }

    // 解析标签内容，所有的TextNode都会被解析为一个单独的节点，其tag为空字符串
    function parseContent(parent: TemplateNode | null) {
        const contentEndIndex = findOutOfTextContentInterpolation(source, templateTagStructureRE)
        const content = source.slice(0, contentEndIndex === -1 ? Infinity : contentEndIndex)
        const contentLen = content.length
        if (contentLen) {
            if (content.trim()) {
                ;(parent?.children || astList).push(
                    initTemplateNode(positions, {
                        content,
                        parent,
                        range: [index, index + contentLen]
                    })
                )
            }
            reduceSource(contentLen)
        }
    }

    function parse(parent: TemplateNode | null) {
        // 解析注释，此时tag为!
        // parse the comment with a tag !
        while (source.startsWith("<!--")) {
            const closedIndex = source.indexOf("-->")
            const contentEndIndex = closedIndex === -1 ? Infinity : closedIndex
            const commentNode = initTemplateNode(positions, {
                tag: "!",
                range: [index, -1],
                content: source.slice(4, contentEndIndex)
            })
            if (closedIndex === -1) {
                reduceSource(source.length)
            } else {
                commentNode.startTagEndPos = commentNode.loc.end = getPosByIndex(
                    (commentNode.range[1] = reduceSource(closedIndex + 3).index)
                )
            }
            return commentNode
        }

        // 检查是否以结束标签开始
        const tagStructure = templateTagStructureRE.exec(source)![0]
        const tagStructureLoc = getLocByIndex(index, index + tagStructure.length)
        if (tagStructure.startsWith("</")) {
            TemplateStartsWithEndTag(`${tagStructure} ... >`, tagStructureLoc)

            // 检查模式下直接快进到结束标签关闭字符，继续执行解析...
            reduceSource(tagStructure.length)
            findCloseCharOfEndTag()
            return
        }

        // 初始 template AST 节点
        const tag = tagStructure.slice(1)
        const isComponent = tagIsComponentRE.test(tag)
        const ast = initTemplateNode(positions, {
            tag,
            parent,
            range: [index, -1],
            componentTag: isComponent ? kebab2Camel(tag, true) : ""
        })
        reduceSource(tag.length + 1)

        // 解析属性
        // parse attributes
        let closeMatched: RegExpExecRet = null
        while (source && !(closeMatched = templateCloseCharsRE.exec(source))) {
            let attrName = ""
            let attrValue = ""
            let endCharIndex = -1
            let nameEndIndex = -1
            let valueEndIndex = -1
            let valueStartIndex = -1
            let wrapValueEndIndex = -1
            let wrapValueStartIndex = -1

            const nameStartIndex = reduceSpaces().index
            const attrNameMatched = templateAttributeNameRE.exec(source)
            if (!isNull(attrNameMatched)) {
                attrName = attrNameMatched[0]
                nameEndIndex = reduceSource(attrName.length).index
            } else {
                const [unexpect] = templateInvalidAttributeNameRE.exec(source)!
                const unexpectEndIndex = reduceSource(unexpect.length).index
                UnexpectedToken(unexpect[0], unexpectEndIndex - unexpect.length, unexpectEndIndex)

                // 检查模式下继续执行解析...
                continue
            }

            // 插值属性长度为1时表示没有指定属性名称
            const isInterpolationAttr = /^[!@#&]/.test(attrName) && !standalone
            if (isInterpolationAttr && attrName.length === 1) {
                EmptyInterpolationAttrName(attrName[0], getLocByIndex(nameStartIndex))
            }

            // check whether attribute value exists
            const equalTokenMatched = /^\s*=/.exec(source)
            if (!isNull(equalTokenMatched)) {
                const mi = equalTokenMatched.index
                const ml = equalTokenMatched[0].length
                const equalTokenEndIndex = reduceSource(mi + ml).index
                const equalTokenEndLoc = getLocByIndex(equalTokenEndIndex)

                // 普通属性值未被引号包裹或插值属性值未被大括号包裹时，如果等号后为空白字符，
                // 则属性值为空字符串，否则属性值则为等号之后的连续的非空白字符串
                if (
                    (isInterpolationAttr && !/^\s*\{/.test(source)) ||
                    (!isInterpolationAttr && !/^\s*['"]/.test(source))
                ) {
                    const endIndex = /\s|>|$/.exec(source)!.index
                    if (!isInterpolationAttr) {
                        AttributeValueIsNotQuoted(equalTokenEndLoc)
                    } else {
                        NoBracketForAttributeInterpolation(equalTokenEndLoc)
                    }
                    if (!isInterpolationAttr) {
                        attrValue = source.slice(0, endIndex)
                    }
                    valueStartIndex = wrapValueStartIndex = equalTokenEndIndex
                    valueEndIndex = wrapValueEndIndex = reduceSource(endIndex).index
                } else {
                    // 属性值格式正确，记录属性值的开始位置，忽略等号与包裹字符间的空白字符
                    const wrapValueStartLoc = getLocByIndex(
                        (wrapValueStartIndex = reduceSpaces().index)
                    )

                    // 如果找不到属性值结束字符（关闭大括号或单双引号）则报错，空插值块也需要报错
                    if (isInterpolationAttr) {
                        if ((endCharIndex = findEndCurlyBracket(source, 1)) === -1) {
                            UnclosedInterpolationExpression(wrapValueStartLoc)
                        } else if (isEmptyString(source.slice(1, endCharIndex).trim())) {
                            EmptyInterpolationExpression(
                                wrapValueStartIndex,
                                index + endCharIndex + 1
                            )
                        }
                    } else if ((endCharIndex = source.indexOf(source[0], 1)) === -1) {
                        UnclosedNormalAttributeValue(wrapValueStartLoc)
                    }

                    // 记录属性值以及属性值的位置信息（不包含前后包裹字符）
                    if (endCharIndex === -1) {
                        attrValue = source.slice(1)
                        valueStartIndex = wrapValueStartIndex
                    } else {
                        valueStartIndex = index + 1
                        valueEndIndex = index + endCharIndex
                        attrValue = source.slice(1, endCharIndex)
                        wrapValueEndIndex = reduceSource(endCharIndex + 1).index
                    }

                    // 如果是插值属性，则将属性值范围内的索引标记为处于script块
                    if (isInterpolationAttr) {
                        for (let i = valueStartIndex; i < valueEndIndex; i++) {
                            markPositionFlag(i, "isScript")
                        }
                    }
                }
            }

            // 记录attribute的AST结构
            const isEnd = valueEndIndex !== -1
            const attrLoc = getLocWithDefaultEnd(nameStartIndex)
            const valueLoc = getLocWithDefaultEnd(valueStartIndex)
            const nameLoc = getLocByIndex(nameStartIndex, nameEndIndex)
            const wrapValueLoc = getLocWithDefaultEnd(wrapValueEndIndex)
            if (valueStartIndex === -1) {
                valueLoc.start = newASTPosition()
            }
            if (isNull(equalTokenMatched)) {
                attrLoc.end = getPosByIndex(nameEndIndex)
            }
            if (isEnd) {
                valueLoc.end = getPosByIndex(valueEndIndex)
                attrLoc.end = wrapValueLoc.end = getPosByIndex(wrapValueEndIndex)
            }
            const attrStruct: TemplateAttribute = {
                key: {
                    raw: attrName,
                    loc: nameLoc
                },
                value: {
                    raw: attrValue,
                    loc: valueLoc
                },
                loc: attrLoc
            }
            ast.attributes.push(attrStruct)
        }

        // 找不到开始标签的关闭字符时，表示整个文件中此标签都未被关闭
        if (isNull(closeMatched) || isEmptyString(closeMatched[0].trim())) {
            TagIsNotClosing(tag, false, tagStructureLoc)
            return ast
        } else {
            ast.startTagEndPos = reduceSource(closeMatched[0].length)
        }

        // script或style标签直接快进到闭合标签处
        const langMatched = templateEmbeddedLangTag.exec(tag)
        const embeddedLang = langMatched?.[1] || ""
        if (specialTags.has(tag) || embeddedLang) {
            const endTagIndex = findOutOfSC(source, "</" + tag)
            const neverOver = endTagIndex === -1
            const contentStartIndex = index
            if (neverOver) {
                TagIsNotClosing(tag, false, tagStructureLoc)
            }

            // 如果没有匹配到结束标签，整个source都被认为是当前标签的内容
            const endtagStartIndex = endTagIndex + index
            const content = source.slice(0, neverOver ? Infinity : endTagIndex)
            reduceSource(neverOver ? source.length : endTagIndex + tag.length + 2)

            // 检查结束标签是否闭合，并记录当前ast节点的相关位置信息
            if (!neverOver) {
                ast.endTagStartPos = getPosByIndex(endtagStartIndex)
                if (findCloseCharOfEndTag()) {
                    ast.range[1] = index
                    ast.loc.end = getPosByIndex(index)
                } else {
                    TagIsNotClosing(tag, true, endTagIndex, index)
                }
            }

            // 如果是特殊标签（这里只能是script或style），则直接返回节点对象
            if (embeddedLang) {
                ast.isEmbedded = true
            } else {
                return (ast.content = content), ast
            }

            // 嵌入语言标签只能出现在顶层作用域
            if (!isNull(ast.parent)) {
                EmbeddedLangNotInTopScope(tag, tagStructureLoc)
            }

            // embedded script block
            if (/js|ts/.test(embeddedLang)) {
                if (scriptDescriptor.existing) {
                    // 检查模式下，快进到脚本块结束位置，继续执行解析...
                    EmbeddedScriptBlockOutOfLimit(tagStructureLoc)
                    return
                }

                // 将嵌入script代码部分都标记为处的索引标记为处于脚本
                for (let i = 0; i < content.length; i++) {
                    markPositionFlag(contentStartIndex + i, "isScript")
                }

                // 记录嵌入script块的内容、是否ts、开始标签名范围、是否已存在以及源码位置信息
                scriptDescriptor.loc = getLocByIndex(contentStartIndex, index)
                scriptDescriptor.isTS = embeddedLang === "ts"
                scriptDescriptor.startTagNameRange = [
                    ast.range[0],
                    ast.range[0] + ast.tag.length + 1
                ]
                scriptDescriptor.existing = true
                scriptDescriptor.code = content

                // 记录生成代码中script部分的行数，4是两个换行符、一行注释、
                // 以及结束行号和开始行号相减少时导致结构少一行的固定量
                const startLine = scriptDescriptor.loc.start.line
                const endLine = scriptDescriptor.loc.end.line
                scriptDescriptor.lineCount = endLine - startLine + 1
            }

            // embedded style block
            if (/css|s[ca]|less|stylus|postcss/.test(embeddedLang)) {
            }

            return ast
        }

        // 自关闭标签或组件开始标签以/>结尾时，无需解析子节点，其他情况解析文本内容和子节点
        // when tag is self-closing tag or a component start tag end in />, there is no need
        // to parse child nodes, otherwise, the content and child nodes should be parsed
        const isSelfClosingTag = selfClosingTags.has(tag)
        if (!isSelfClosingTag && !closeMatched[2]) {
            while (true) {
                const endtagStartIndex = index
                const endTagMatched = new RegExp(`^</${tag}`).exec(source)
                if (!isNull(endTagMatched)) {
                    reduceSource(endTagMatched[0].length)
                    ast.endTagStartPos = getPosByIndex(endtagStartIndex)

                    // 未找到结束标签的关闭字符时报错
                    if (findCloseCharOfEndTag()) {
                        ast.range[1] = index
                        ast.loc.end = positions[index]
                    } else {
                        TagIsNotClosing(tag, true, endtagStartIndex, index)
                    }
                    break
                }

                if (!source) {
                    NoEndTagMatched(tag, tagStructureLoc)
                    break
                }

                // 继续递归解析textContext或子标签
                if (startWithTagStructureRE.test(source)) {
                    const child = parse(ast)
                    child && ast.children.push(child)
                } else {
                    parseContent(ast)
                }
            }
        } else if (isSelfClosingTag || (isComponent && closeMatched[2])) {
            ast.range[1] = index
            ast.loc.end = getPosByIndex(index)
            ast.startTagEndPos = getPosByIndex(index)
        } else {
            TagCanNotBeSelfClosing(tag, index - 2, index)
        }
        return ast
    }

    while (index < sourceLength) {
        parseContent(null)
        if (source) {
            const ast = parse(null)
            ast && astList.push(ast)
        }
    }

    // 过滤无需渲染的节点，规则如下：
    // 1. template标签且无子节点时无需保留
    // 2.不保留所有注释（通过编译选项设置）时只保留条件注释；
    return (function filter(list: TemplateNode[]) {
        return list.filter(({ tag, content, children }) => {
            let shouldReserve = true

            if (tag === "template") {
                shouldReserve = children.length > 0
            } else if (tag === "!") {
                if (reserveAllComment) {
                    shouldReserve = true
                } else {
                    shouldReserve = templateConditionalCommentRE.test(content)
                }
            }

            if (shouldReserve) {
                replaceEachItems(children, filter(children))
            }

            return shouldReserve
        })
    })(astList)
}

// 初始化一个template抽象语法树节点
// initialize a template AST node
function initTemplateNode(
    positions: ASTPosition[],
    options: Partial<TemplateNode> = {}
): TemplateNode {
    if (!options.loc) {
        const { range } = options
        if (range) {
            options.loc = {
                start: positions[range[0]],
                end: positions[range[1]]
            }
            if (range[1] === -1) {
                options.loc.end = newASTPosition()
            }
        }
    }
    return {
        parent: options.parent || null,
        tag: options.tag || "",
        isEmbedded: false,
        content: options.content || "",
        range: options.range || [-1, -1],
        startTagEndPos: newASTPosition(),
        endTagStartPos: newASTPosition(),
        attributes: options.attributes || [],
        loc: options.loc || newASTLocation(),
        componentTag: options.componentTag || "",
        children: options.children || []
    }
}

// 在textContent范围内脱离插值表达式范围查找字符位置，目前只有一处使用：在textContent范围内
// 脱离插值表达式的范围找到下一个开始标签的位置，这个方法可以过滤多个插值表达式返回进行查找
function findOutOfTextContentInterpolation(str: string, re: RegExp) {
    let startIndex = 0

    while (true) {
        const matched = str.match(re)
        if (isNull(matched)) {
            return -1
        }

        const searchStr = str.slice(0, matched.index)
        const startBracketIndex = searchStr.indexOf("{")
        if (startBracketIndex === -1) {
            return startIndex + matched.index!
        }

        const endBracketIndex = findEndCurlyBracket(str, startBracketIndex + 1)
        if (endBracketIndex === -1) {
            return -1
        }
        startIndex += endBracketIndex + 1
        str = str.slice(endBracketIndex + 1)
    }
}
