import type {
    ASTLocation,
    ASTPosition,
    TemplateNode,
    RegExpExecRet,
    TemplateAttribute
} from "../types"

import {
    tagIsComponentRE,
    templateCloseCharsRE,
    templateTagStructureRE,
    templateAttributeNameRE,
    startWithTagStructureRE,
    templateAttributeValueRE,
    templateConditionalCommentRE,
    templateInvalidAttributeNameRE
} from "../regular"
import {
    UnexpectedToken,
    TagIsNotClosing,
    TagCantBeSelfClosing,
    EmptyInterpolationAttrName,
    TemplateStartsWithEndTag,
    UnclosedNormalAttributeValue,
    AttributeValueIsNotQuoted,
    EmptyInterpolationExpression,
    EmbeddedScriptBlockOutOfLimit,
    UnclosedInterpolationExpression,
    NoBracketForAttributeInterpolation
} from "../message/error"
import { inputDescriptor } from "../state"
import { isNull } from "../../util/shared/assert"
import { compilerOptions } from "../configuration"
import { AttributeForEndTag } from "../message/warn"
import { replaceEachItems } from "../../util/shared/sundry"
import { specialTags, selfClosingTags } from "../constants"
import { newASTLocation } from "../../util/compiler/structure"
import { getPositionOfEachChar } from "../../util/compiler/sundry"
import { getLocByIndex, getPosByIndex } from "../../util/compiler/locations"
import { findEndCurlyBracket, findOutOfSC } from "../../util/compiler/strings"

// 这里采用嵌套函数的方式主要是为了共享index、source等变量，并在解析完成后自动清理
export function parseTemplate(source: string) {
    let index = 0
    let closeMatched: RegExpExecRet

    const astList: TemplateNode[] = []
    const sourceLength = source.length
    const positions = (inputDescriptor.positions = getPositionOfEachChar(source))

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

        if (source.startsWith(">")) {
            reduceSource(1)
        }
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
        const ast = initTemplateNode(positions, {
            tag,
            parent,
            range: [index, -1]
        })
        reduceSource(tag.length + 1)

        // 嵌入语言直接找到闭合标签，如果是脚本语言则记录缩进空格数量，源码偏移量等信息
        const langMatched = /^lang-(\w+)/.exec(tag)
        if (!isNull(langMatched)) {
            const startIndex = findOutOfSC(source, ">") + 1
            const endIndex = findOutOfSC(source, `</${langMatched[0]}`)
            const [blockEndIndex] = findOutOfSC(source, ">", endIndex)

            // script block
            if (/js|ts/.test(langMatched[1])) {
                const scriptDescriptor = inputDescriptor.script
                if (scriptDescriptor.existing) {
                    // 检查模式下，快进到脚本块结束位置，继续执行解析...
                    EmbeddedScriptBlockOutOfLimit(tagStructureLoc)
                    return reduceSource(blockEndIndex + 1), void 0
                }
                scriptDescriptor.loc = getLocByIndex(index + startIndex, index + endIndex)
                scriptDescriptor.code = source.slice(startIndex, endIndex)
                scriptDescriptor.isTS = langMatched[1] === "ts"
                scriptDescriptor.existing = true

                // 记录生成代码中script部分的行数，4是两个换行符、一行注释、
                // 以及结束行号和开始行号相减少时导致结构少一行的固定量
                const startLine = scriptDescriptor.loc.start.line
                const endLine = scriptDescriptor.loc.end.line
                scriptDescriptor.lineCount = endLine - startLine + 1
            }

            // style block
            if (/css|s[ca]|less|stylus|postcss/.test(langMatched[1])) {
            }

            return reduceSource(blockEndIndex + 1), void 0
        }

        // 解析属性
        // parse attributes
        while (!(closeMatched = templateCloseCharsRE.exec(source))) {
            let attrName = ""
            let attrValue = ""
            let attrNameEndIndex = -1
            let attrValueEndIndex = -1
            let attrValueStartIndex = -1

            const attrNameStartIndex = reduceSpaces().index
            const attrNameMatched = templateAttributeNameRE.exec(source)
            if (!isNull(attrNameMatched)) {
                attrName = attrNameMatched[0]
                attrNameEndIndex = reduceSource(attrName.length).index
            } else {
                const [unexpect] = templateInvalidAttributeNameRE.exec(source)!
                const unexpectEndIndex = reduceSource(unexpect.length).index
                UnexpectedToken(unexpect[0], unexpectEndIndex - unexpect.length, unexpectEndIndex)

                // 检查模式下继续执行解析...
                if (source) continue
                else break
            }

            // 插值属性长度为1时表示没有指定属性名称
            const isInterpolationAttr = /^[!@#&]/.test(attrName)
            if (isInterpolationAttr && attrName.length === 1) {
                EmptyInterpolationAttrName(attrName[0], getLocByIndex(attrNameStartIndex))
            }

            // check whether attribute value exists
            const equalTokenMatched = /^\s*=/.exec(source)
            if (!isNull(equalTokenMatched)) {
                let recoverdCodeInCheckMode = 0
                const equalTokenMatchedIndex = equalTokenMatched.index
                const equalTokenMatchedLen = equalTokenMatched[0].length
                reduceSource(equalTokenMatchedIndex + equalTokenMatchedLen)

                if (!isInterpolationAttr) {
                    // 普通属性值必须被引号包裹
                    const attrValueStartLoc = getLocByIndex(reduceSpaces().index)
                    if (!/^['"]/.test(source)) {
                        recoverdCodeInCheckMode = 2
                        AttributeValueIsNotQuoted(attrValueStartLoc)
                    } else {
                        const valueMatched = templateAttributeValueRE.exec(source)
                        if (!isNull(valueMatched)) {
                            attrValue = valueMatched[2]
                            attrValueStartIndex = index + 1
                            attrValueEndIndex = index + valueMatched[0].length - 1
                        } else {
                            recoverdCodeInCheckMode = 1
                            UnclosedNormalAttributeValue(attrValueStartLoc)
                        }
                    }
                } else {
                    // 插值属性值必须被大括号包裹
                    const attrValueStartLoc = getLocByIndex(reduceSpaces().index)
                    if (!source.startsWith("{")) {
                        recoverdCodeInCheckMode = 2
                        NoBracketForAttributeInterpolation(attrValueStartLoc)
                    } else {
                        const valueEndIndex = findEndCurlyBracket(source, 1)
                        if (valueEndIndex === -1) {
                            recoverdCodeInCheckMode = 1
                            UnclosedInterpolationExpression(attrValueStartLoc)
                        } else if (1 === valueEndIndex) {
                            // 检查模式下，快进到属性值结束处，继续执行解析...
                            reduceSource(valueEndIndex + 1)
                            EmptyInterpolationExpression({
                                start: attrValueStartLoc.start,
                                end: getPosByIndex(index)
                            })
                            continue
                        } else {
                            attrValueStartIndex = index + 1
                            attrValueEndIndex = index + valueEndIndex
                            attrValue = source.slice(1, valueEndIndex)
                        }
                    }
                }

                // 检查模式下，针对以下两种错误类型进行恢复解析：
                // 1. 普通属性引号未关闭或插值属性大括号未关闭（快进到文件结尾，并终止解析执行）
                // 2. 普通属性未被引号包裹或插值属性未被大括号包裹（快进到恢复执行字符：空白字符/标签关闭字符>/文件结尾，并继续执行解析）
                if (recoverdCodeInCheckMode === 1) {
                    reduceSource(source.length)
                    return TagIsNotClosing(tag, tagStructureLoc)
                } else if (recoverdCodeInCheckMode === 2) {
                    reduceSource(/\s|>|$/.exec(source)!.index)
                    continue
                }
            }

            // 记录attribute的AST结构
            let attrEndIndex: number
            let attrValueLoc: ASTLocation
            const hasAttrValue = attrValueStartIndex !== -1
            if (!hasAttrValue) {
                attrValueLoc = newASTLocation()
                attrEndIndex = attrNameEndIndex
            } else {
                attrValueLoc = {
                    start: positions[attrValueStartIndex],
                    end: positions[attrValueEndIndex]
                }
                attrEndIndex = attrValueEndIndex + 1
            }

            const attrStruct: TemplateAttribute = {
                key: {
                    raw: attrName,
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
                    end: positions[attrEndIndex]
                }
            }
            if (hasAttrValue) {
                reduceSource(attrValueEndIndex - index + 1)
            }
            ast.attributes.push(attrStruct)
        }

        if (!isNull(closeMatched)) {
            reduceSource(closeMatched[0].length)
        } else {
            return TagIsNotClosing(tag, tagStructureLoc)
        }

        // 解析文本内容和子节点
        // process text content and child nodes
        if (!selfClosingTags.has(tag)) {
            if (closeMatched[2]) {
                if (tagIsComponentRE.test(tag)) {
                    return ast
                } else {
                    const selfClosingLoc = {
                        start: positions[index - 2],
                        end: positions[index]
                    }
                    TagCantBeSelfClosing(tag, selfClosingLoc)
                }
            } else {
                while (true) {
                    const endTagMatched = new RegExp(`^</${tag}`).exec(source)
                    if (!isNull(endTagMatched)) {
                        reduceSource(endTagMatched[0].length)
                        findCloseCharOfEndTag()
                        break
                    }

                    // 文件结束，代表此标签未被关闭
                    if (!source) {
                        TagIsNotClosing(tag, tagStructureLoc)
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
            }
        }
        ast.range[1] = index
        ast.loc.end = positions[index]

        // 如果是注释节点，根据配置判断是否保留所有注释，若不保留所有则单独保留条件注释
        const reserveAllComment = compilerOptions.reserveTemplateComment
        const isConditionalComment = templateConditionalCommentRE.test(ast.content)
        const reserveThisComment = tag === "!" && (reserveAllComment || isConditionalComment)
        if (!specialTags.has(tag) || !reserveThisComment) {
            return ast
        }
    }

    while (index < sourceLength) {
        parseContent(null)
        if (source) {
            const ast = parse(null)
            ast && astList.push(ast)
        }
    }
    inputDescriptor.positions = positions

    // 过滤无需渲染的节点，规则如下：
    // 1. template标签且无子节点时无需保留
    // 2.不保留所有注释（通过编译选项设置）时只保留条件注释；
    return (function filter(list: TemplateNode[]) {
        return list.filter(({ tag, content, children }) => {
            let shouldReserve = true

            if (tag === "template") {
                shouldReserve = children.length > 0
            } else if (tag === "!") {
                if (compilerOptions.reserveTemplateComment) {
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

// 在textContent范围内脱离插值表达式范围查找字符位置，目前只有一处使用：在textContent范围内
// 脱离插值表达式的范围找到下一个开始标签的位置，这个方法可以过滤多个插值表达式返回进行查找
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
