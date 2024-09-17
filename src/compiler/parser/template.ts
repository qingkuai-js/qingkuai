import type {
    ASTLocation,
    ASTPosition,
    RegExpExecRet,
    TemplateAttribute,
    TemplateNode
} from "../types"

import {
    TagIsNotClosing,
    BadAttributeFormat,
    InvalidTagInTemplate,
    TemplateStartsWithEndTag,
    AttributeValueIsNotQuoted,
    EmptyInterpolationExpression,
    NoBracketForAttributeExpression,
    TagCantBeSelfClosing
} from "../message/error"
import {
    templateEndTagRE,
    templateStartTagRE,
    templateAttributeRE,
    templateCloseCharsRE,
    templateInvalidAttrNameRE,
    templateConditionalCommentRE,
    templateNormalAttributeValueRE
} from "../regular"
import {
    findOutOfSC,
    newASTLocation,
    newASTPosition,
    getPositionOfEachChar
} from "../../util/compiler/sundry"
import { isNull } from "../../util/shared"
import { inputDescriptor } from "../state"
import { compilerOptions } from "../configuration"
import { specialTags, selfClosingTags } from "../constants"

// 这里采用嵌套函数的方式主要是为了共享index、source等变量，并在解析完成后自动清理
export function parseTemplate(source: string) {
    let index = 0
    let closeMatched: RegExpExecRet

    const astList: TemplateNode[] = []
    const sourceLength = source.length
    const positions = getPositionOfEachChar(source)

    // 收缩source并修改index
    // reduce souce and change index
    function reduceSource(start: number) {
        index += start
        source = source.slice(start)
    }

    // 解析标签内容，所有的TextNode都会被解析为一个单独的节点，其tag为空字符串
    function parseContent(parent: TemplateNode | null) {
        const contentEndIndex = findOutOfTextContentInterpolation(source, /<\/?\S/)
        const content = source.slice(0, contentEndIndex)
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
        if (source.startsWith("</")) {
            const endTagMatched = templateEndTagRE.exec(source)
            if (isNull(endTagMatched)) {
                InvalidTagInTemplate()
            } else {
                TemplateStartsWithEndTag(endTagMatched[0])
            }
        }

        // 解析注释，此时tag为!
        // parse the comment with a tag !
        while (source.startsWith("<!--")) {
            const endCharsIndex = source.indexOf("-->")
            const range: TemplateNode["range"] = [index, -1]
            const commentContent = source.slice(4, endCharsIndex)
            if (endCharsIndex !== -1) {
                reduceSource(endCharsIndex + 3)
                range[1] = index
            }
            return initTemplateNode(positions, {
                range,
                tag: "!",
                children: [
                    initTemplateNode(positions, {
                        tag: "",
                        content: commentContent,
                        range: [range[0] + 4, index - 3]
                    })
                ]
            })
        }

        // 未闭合或不合法的标签
        // not closing or unexpected tag
        const startTagMatched = templateStartTagRE.exec(source)!
        if (isNull(startTagMatched)) {
            console.log("???", source)
            InvalidTagInTemplate()
        }

        const ast = initTemplateNode(positions, {
            parent,
            range: [index, -1],
            tag: startTagMatched[1]
        })
        const isScript = ast.tag === "script"
        reduceSource(ast.tag.length + 1)

        // 解析属性
        // parse attributes
        while (!(closeMatched = templateCloseCharsRE.exec(source))) {
            let attrValue = ""
            let attrNameEndIndex = -1
            let attrValueEndIndex = -1
            let attrNameStartIndex = -1
            let attrValueStartIndex = -1

            const attrNameMatched = templateAttributeRE.exec(source)!
            if (templateInvalidAttrNameRE.test(attrNameMatched[2])) {
                BadAttributeFormat(attrNameMatched[2])
            } else {
                attrNameStartIndex = index + attrNameMatched[1].length
                attrNameEndIndex = index + attrNameMatched[0].length
                reduceSource(attrNameMatched[0].length)
            }

            // check whether attribute value is existing
            const equalTokenIndex = source.indexOf("=")
            if (equalTokenIndex !== -1) {
                reduceSource(equalTokenIndex + 1)

                if (!/^[!@#&]/.test(attrNameMatched[2])) {
                    const valueMatched = templateNormalAttributeValueRE.exec(source)
                    if (isNull(valueMatched)) {
                        AttributeValueIsNotQuoted()
                    } else {
                        attrValue = valueMatched[3]
                        attrValueStartIndex = index + valueMatched[1].length
                        attrValueEndIndex = index + valueMatched[0].length - 1
                    }
                } else {
                    const valueStartIndex = source.indexOf("{")
                    const valueEndIndex = findEndCurlyBracket(source, valueStartIndex + 1)
                    if (valueStartIndex === -1 || valueEndIndex === -1) {
                        NoBracketForAttributeExpression()
                    } else if (valueStartIndex + 1 === valueEndIndex) {
                        EmptyInterpolationExpression()
                    } else {
                        attrValueEndIndex = index + valueEndIndex
                        attrValueStartIndex = index + valueStartIndex + 1
                        attrValue = source.slice(valueStartIndex + 1, valueEndIndex)
                    }
                }
            }

            const hasAttrValue = attrValueStartIndex !== -1
            const attrValueLoc: ASTLocation = hasAttrValue
                ? {
                      start: positions[attrValueStartIndex],
                      end: positions[attrValueEndIndex]
                  }
                : {
                      start: newASTPosition(),
                      end: newASTPosition()
                  }
            const attrStruct: TemplateAttribute = {
                key: {
                    raw: attrNameMatched[2],
                    loc: {
                        start: positions[attrNameStartIndex],
                        end: positions[attrNameEndIndex]
                    }
                },
                value: {
                    raw: attrValue,
                    loc: attrValueLoc
                },
                loc: {
                    start: positions[attrNameStartIndex],
                    end: positions[attrValueEndIndex]
                }
            }
            if (hasAttrValue) {
                reduceSource(attrValueEndIndex - index + 1)
            }
            ast.attributes.push(attrStruct)
        }
        reduceSource(closeMatched[0].length)

        // script标签直接找到闭合标签，并记录缩进空格数量，源码偏移量等信息
        if (isScript) {
            const endIndex = findOutOfSC(source, "</script>")
            inputDescriptor.script.loc = {
                start: positions[index],
                end: positions[endIndex + index]
            }
            inputDescriptor.script.code = source.slice(0, endIndex)
            reduceSource(endIndex + 9)
            return
        }

        // 解析文本内容和子节点
        // process text content and child nodes
        if (!selfClosingTags.has(ast.tag)) {
            if (closeMatched[2]) {
                TagCantBeSelfClosing(ast.tag)
            } else {
                while (true) {
                    const endTagMatched = new RegExp(`^</${ast.tag}\\s*>`).exec(source)
                    if (!isNull(endTagMatched)) {
                        reduceSource(endTagMatched[0].length)
                        break
                    }
                    if (!source) {
                        TagIsNotClosing(ast.tag)
                    }
                    if (!/<\s/.test(source)) {
                        parseContent(ast)
                    } else {
                        const child = parse(ast)
                        child && ast.children.push(child)
                    }
                }
            }
        }
        ast.range[1] = index
        ast.loc.end = positions[index]

        // 如果是注释节点，根据配置判断是否保留所有注释，若不保留所有则单独保留条件注释
        const reserveAllComment = compilerOptions.reserveTemplateComment
        const isConditionalComment = templateConditionalCommentRE.test(ast.content)
        const reserveThisComment = ast.tag === "!" && (reserveAllComment || isConditionalComment)
        if (!specialTags.has(ast.tag) || !reserveThisComment) {
            return ast
        }
    }

    while (true) {
        parseContent(null)
        if (index >= sourceLength) {
            break
        }

        const ast = parse(null)
        ast && astList.push(ast)
    }
    inputDescriptor.positions = positions

    // 需要保留所有注释
    if (compilerOptions.reserveTemplateComment) {
        return astList
    }

    // 只保留条件注释
    return astList.filter(ast => {
        return ast.tag !== "!" || templateConditionalCommentRE.test(ast.content)
    })
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
        }
    }
    return {
        parent: options.parent || null,
        tag: options.tag || "",
        content: options.content || "",
        range: options.range || [-1, -1],
        loc: options.loc || newASTLocation(),
        attributes: options.attributes || [],
        children: options.children || []
    }
}

// 在textContent范围内脱离插值表达式范围查找字符位置
function findOutOfTextContentInterpolation(str: string, re: RegExp) {
    let startIndex = 0
    let searchStr = str

    const findOfSearchStr = () => {
        const matched = re.exec(searchStr)
        if (isNull(matched)) {
            return -1
        }
        return startIndex + matched.index
    }

    while (true) {
        const startBracketIndex = str.indexOf("{", startIndex)
        if (startBracketIndex === -1) {
            searchStr = str.slice(startIndex)
            return findOfSearchStr()
        }
        searchStr = str.slice(startIndex, startBracketIndex)

        const matchedIndex = findOfSearchStr()
        if (matchedIndex !== -1) {
            return matchedIndex
        }

        const endBracketIndex = findEndCurlyBracket(str, startBracketIndex + 1)
        if (endBracketIndex === -1) {
            return -1
        }
        startIndex = endBracketIndex + 1
    }
}

// 找到属性值表达式中关闭大括号的位置
function findEndCurlyBracket(str: string, startIndex: number) {
    while (true) {
        const [startBracketIndex] = findOutOfSC(str, "{", startIndex)
        const [endBracketIndex] = findOutOfSC(str, "}", startIndex)
        if (endBracketIndex === -1) {
            return -1
        }
        if (startBracketIndex === -1 || endBracketIndex < startBracketIndex) {
            return endBracketIndex
        }
        startIndex = endBracketIndex + 1
    }
}
