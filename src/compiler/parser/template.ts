import type { RegExpExecRet, TemplateAttribute, TemplateNode } from "../types"

import {
    templateEndTagRE,
    templateContentRE,
    templateCloseTagRE,
    templateStartTagRE,
    templateAttributeRE,
    conditionalCommentRE
} from "../regular"
import { inputDescriptor } from "../state"
import { compilerOptions } from "../configuration"
import { specialTags, selfClosingTags } from "../constants"
import { findOutOfSC, newASTLocation, getPositionOfEachChar } from "../../util/compiler/sundry"
import { InvalidTagInTemplate, TagIsNotClosing, TemplateStartsWithEndTag } from "../message/error"
import { isUndefined } from "../../util/shared"

// 这里采用嵌套函数的方式主要是为了共享index、source等变量，并在解析完成后自动清理
export function parseTemplate(source: string) {
    let index = 0
    let closeMatched: RegExpExecRet
    let endTagMatched: RegExpExecRet

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
        const content = templateContentRE.exec(source)![0]
        const contentLen = content.length
        if (contentLen) {
            if (content.trim()) {
                ;(parent?.children || astList).push(
                    initTemplateNode({
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
            endTagMatched = templateEndTagRE.exec(source)
            if (!endTagMatched) {
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
            return initTemplateNode({
                range,
                tag: "!",
                children: [
                    initTemplateNode({
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
        if (!startTagMatched) {
            InvalidTagInTemplate()
        }

        const ast = initTemplateNode({
            parent,
            range: [index, -1],
            tag: startTagMatched[1]
        })
        const isScript = ast.tag === "script"
        reduceSource(ast.tag.length + 1)

        // 解析属性
        // parse attributes
        while (!(closeMatched = templateCloseTagRE.exec(source))) {
            const attr = templateAttributeRE.exec(source)!
            const endIndex = index + attr[0].length
            const startIndex = index + attr[1].length
            const keyEndIndex = startIndex + attr[2].length
            const valueStartIndex = endIndex - attr[4]?.length - 1
            const attrStruct: TemplateAttribute = {
                key: {
                    raw: attr[2],
                    loc: {
                        start: positions[startIndex],
                        end: positions[keyEndIndex]
                    }
                },
                value: {
                    raw: attr[4] || "",
                    loc: {
                        start: positions[valueStartIndex],
                        end: positions[endIndex - 1]
                    }
                },
                loc: {
                    start: positions[startIndex],
                    end: positions[endIndex]
                }
            }
            reduceSource(attr[0].length)
            ast.attributes.push(attrStruct)
            if (isScript) {
                const {
                    key: { raw: key },
                    value: { raw: value }
                } = attrStruct
                if (key === "lang" && value === "ts") {
                    inputDescriptor.script.isTS = true
                }
            }
            if (isUndefined(attr[4])) {
                attrStruct.value.loc = newASTLocation()
            }
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
        if (!selfClosingTags.has(ast.tag) && !closeMatched[2]) {
            while (!(endTagMatched = new RegExp(`^</${ast.tag}[^>]*>`).exec(source))) {
                if (!source) {
                    TagIsNotClosing(ast.tag)
                }
                if (!source.startsWith("<")) {
                    parseContent(ast)
                } else {
                    const child = parse(ast)
                    child && ast.children.push(child)
                }
            }
            reduceSource(endTagMatched[0].length)
        }
        ast.range[1] = index
        ast.loc.end = positions[index]

        // 如果是注释节点，根据配置判断是否保留所有注释，若不保留所有则单独保留条件注释
        const reserveAllComment = compilerOptions.reserveTemplateComment
        const isConditionalComment = conditionalCommentRE.test(ast.content)
        const reserveThisComment = ast.tag === "!" && (reserveAllComment || isConditionalComment)
        if (!specialTags.has(ast.tag) || !reserveThisComment) {
            return ast
        }
    }

    // 初始化一个template抽象语法树节点
    // initialize a template AST node
    function initTemplateNode(options: Partial<TemplateNode> = {}): TemplateNode {
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
        return ast.tag !== "!" || conditionalCommentRE.test(ast.content)
    })
}
