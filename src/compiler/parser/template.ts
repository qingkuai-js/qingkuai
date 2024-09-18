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
    TagCantBeSelfClosing,
    TemplateStartsWithEndTag,
    AttributeValueIsNotQuoted,
    EmptyInterpolationAttrName,
    EmptyInterpolationExpression,
    EmbeddedScriptBlockOutOfLimit,
    NoValueForRequiredValueAttribute,
    NoBracketForAttributeInterpolation
} from "../message/error"
import {
    templateEndTagRE,
    templateStartTagRE,
    templateAttributeRE,
    templateCloseCharsRE,
    templateTagStructureRE,
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
import { inputDescriptor, sourceMapInfo } from "../state"
import { compilerOptions } from "../configuration"
import { specialTags, selfClosingTags, mustPassValueDirectives } from "../constants"

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
        if (/^<\/\S/.test(source)) {
            const endTagMatched = templateEndTagRE.exec(source)!
            TemplateStartsWithEndTag(endTagMatched[0])
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
        const ast = initTemplateNode(positions, {
            parent,
            range: [index, -1],
            tag: startTagMatched[1]
        })
        reduceSource(ast.tag.length + 1)

        // 嵌入语言直接找到闭合标签，如果是脚本语言则记录缩进空格数量，源码偏移量等信息
        const langMatched = /^lang-(\w+)/.exec(ast.tag)
        if (!isNull(langMatched)) {
            const startIndex = findOutOfSC(source, ">") + 1
            const endIndex = findOutOfSC(source, `</${langMatched[0]}`)
            const [blockEndIndex] = findOutOfSC(source, ">", endIndex)

            // script block
            if (/js|ts/.test(langMatched[1])) {
                const scriptDescriptor = inputDescriptor.script
                if (scriptDescriptor.existing) {
                    EmbeddedScriptBlockOutOfLimit()
                }
                scriptDescriptor.loc = {
                    start: positions[index + startIndex],
                    end: positions[index + endIndex]
                }
                scriptDescriptor.code = source.slice(startIndex, endIndex)
                scriptDescriptor.isTS = langMatched[1] === "ts"
                scriptDescriptor.existing = true

                // 记录生成代码中script部分的行数，4是两个换行符、一行注释、
                // 以及结束行号和开始行号相减少时导致结构少一行的固定量
                const startLine = scriptDescriptor.loc.start.line
                const endLine = scriptDescriptor.loc.end.line
                if (startLine !== endLine) {
                    sourceMapInfo.generatedScriptLineCount = endLine - startLine + 4
                }
            }

            // style block
            if (/css|s[ca]|less|stylus|postcss/.test(langMatched[1])) {
            }

            return reduceSource(blockEndIndex + 1), void 0
        }

        // 解析属性
        // parse attributes
        while (!(closeMatched = templateCloseCharsRE.exec(source))) {
            let attrValue = ""
            let attrNameEndIndex = -1
            let attrValueEndIndex = -1
            let attrNameStartIndex = -1
            let attrValueStartIndex = -1

            const attrNameMatched = templateAttributeRE.exec(source)!
            const [attrFull, attrPreSpace, attrName] = attrNameMatched
            const isInterpolationAttr = /^[!@#&]/.test(attrName)

            // 插值属性长度为1时代表没有指定属性名称
            if (isInterpolationAttr && attrName.length === 1) {
                EmptyInterpolationAttrName(attrName[0])
            }

            // 检查属性名称是否以不允许的字符开头
            if (templateInvalidAttrNameRE.test(attrName)) {
                BadAttributeFormat(attrName)
            } else {
                attrNameStartIndex = index + attrPreSpace.length
                attrNameEndIndex = index + attrFull.length
                reduceSource(attrFull.length)
            }

            // check whether attribute value is existing
            const equalTokenIndex = source.indexOf("=")
            if (equalTokenIndex !== -1) {
                reduceSource(equalTokenIndex + 1)

                if (!isInterpolationAttr) {
                    const valueMatched = templateNormalAttributeValueRE.exec(source)
                    if (isNull(valueMatched)) {
                        AttributeValueIsNotQuoted()
                    } else {
                        attrValue = valueMatched[3]
                        attrValueStartIndex = index + valueMatched[1].length
                        attrValueEndIndex = index + valueMatched[0].length - 1
                    }
                } else {
                    // 插值属性值必须被大括号包裹
                    const valueStartMatched = /^\s*\{/.exec(source)
                    if (isNull(valueStartMatched)) {
                        NoBracketForAttributeInterpolation()
                    }

                    const valueStartIndex = valueStartMatched!.index + 1
                    const valueEndIndex = findEndCurlyBracket(source, valueStartIndex)
                    if (valueEndIndex === -1) {
                        NoBracketForAttributeInterpolation()
                    } else if (valueStartIndex === valueEndIndex) {
                        EmptyInterpolationExpression()
                    } else {
                        attrValueEndIndex = index + valueEndIndex
                        attrValueStartIndex = index + valueStartIndex
                        attrValue = source.slice(valueStartIndex, valueEndIndex)
                    }
                }
            }

            // 检查必须传递属性值的属性是否有值
            const hasAttrValue = attrValueStartIndex !== -1
            if (isInterpolationAttr && !hasAttrValue) {
                if (attrName[0] !== "#" || mustPassValueDirectives.has(attrName.slice(1))) {
                    NoValueForRequiredValueAttribute(attrName)
                }
            }

            // 记录attribute的AST结构
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

        // 解析文本内容和子节点
        // process text content and child nodes
        if (!selfClosingTags.has(ast.tag)) {
            if (closeMatched[2]) {
                TagCantBeSelfClosing(ast.tag)
            } else {
                while (true) {
                    const endTagMatched = new RegExp(`^</${ast.tag}\\s*>`).exec(source)
                    const startWithTagStructureRE = new RegExp("^" + templateTagStructureRE.source)
                    if (!isNull(endTagMatched)) {
                        reduceSource(endTagMatched[0].length)
                        break
                    }
                    if (!source) {
                        TagIsNotClosing(ast.tag)
                    }
                    if (!startWithTagStructureRE.test(source)) {
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

// 找到插值表达式中关闭大括号的位置
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
