import type {
    ASTLocation,
    ASTPosition,
    TemplateNode,
    StyleDescriptor,
    ScriptDescriptor
} from "#type-declarations/compiler"
import type { ExpectedTemplateNode, ExpectedCompileMessage } from "#type-declarations/testing"

import {
    getLocByIndex,
    getRangeByLocation,
    isPositionFlagSetInLoc,
    isPositionFlagSetAtIndex
} from "../../../../src/util/compiler/position"
import { expect } from "vitest"
import { PositionFlag } from "../../../../src/compiler/enums"
import { isNumber } from "../../../../src/util/shared/assert"
import { inputDescriptor } from "../../../../src/compiler/state"
import { matchCompileMessages } from "../../../../src/util/testing/match"
import { newTemplateNode } from "../../../../src/compiler/parser/template"
import { getStartTagOpenLoc } from "../../../../src/util/compiler/template"

const showCustomAsseertMessage = true

// 匹配验证 TemplateNode 列表
// Match and validate the TemplateNode list
export function matchTemplateNodeList(
    nodeList: TemplateNode[],
    ...expectedList: ExpectedTemplateNode[]
) {
    expect(nodeList.length).toBe(expectedList.length)

    for (let i = 0; i < nodeList.length; i++) {
        // Assert that position flags are set correctly
        nodeList[i].content.forEach(item => {
            if (item.isInterpolated) {
                assertPositionFlagIsSet(PositionFlag.InScript, item.loc)
            }
        })
        nodeList[i].attributes.forEach(item => {
            if (item.valueEnclosure === "curly") {
                assertPositionFlagIsSet(PositionFlag.InScript, item.value.loc)
            }
            assertPositionFlagIsSet(PositionFlag.IsAttributeStart, item.name.loc.start)
        })
        if (nodeList[i].isEmbedded) {
            if (nodeList[i].content.length) {
                assertPositionFlagIsSet(
                    PositionFlag[/[jt]s$/.test(nodeList[i].tag) ? "InScript" : "InStyle"],
                    nodeList[i].content[0].loc
                )
            }
            assertEmbeddedLangDescriptor(nodeList[i])
        }
        if (nodeList[i].componentTag) {
            assertPositionFlagIsSet(PositionFlag.IsComponentStart, nodeList[i].loc.start)
        }

        // 断言节点结构与给定项目相同（deep equal）
        // Assert that the node structure deeply equals the given item (expectedList)
        expect(
            nodeList[i],
            showCustomAsseertMessage
                ? `The expected template node structure does not match result for ${
                      expectedList[i].tag || '""'
                  }_${expectedList[i].loc?.start.index}_${expectedList[i].loc?.end.index}`
                : void 0
        ).toEqual({
            ...newTemplateNode(),
            ...expectedList[i],
            children: nodeList[i].children,
            rawTag: expectedList[i].rawTag ?? expectedList[i].tag
        })
        if (nodeList[i].children.length) {
            matchTemplateNodeList(nodeList[i].children, ...(expectedList[i].children || []))
        }
    }
}

// 匹配验证 TemplateNode 及编译消息列表
// Match and validate the TemplateNode and compile message list
export function matchTemplateNodeListAndMessages(
    parseAndGetExpectedList: () => [TemplateNode[], ...ExpectedTemplateNode[]],
    expectedMessages: ExpectedCompileMessage[]
) {
    const [nodeList, ...expectedList] = parseAndGetExpectedList()
    matchCompileMessages(expectedMessages)
    matchTemplateNodeList(nodeList, ...expectedList)
}

// 断言编译位置信息中标志位的设置情况
// Assert the flag settings in the compile position information
function assertPositionFlagIsSet(flag: PositionFlag, target: number | ASTPosition | ASTLocation) {
    const prefix = `Position flag(${PositionFlag[flag]}) is not set correctly `
    if (!isNumber(target) && "start" in target) {
        expect(
            isPositionFlagSetInLoc(flag, target),
            showCustomAsseertMessage
                ? prefix + `in range: [${target.start.index}, ${target.end.index}]`
                : void 0
        ).toBeTruthy()
    } else {
        expect(
            isPositionFlagSetAtIndex(flag, isNumber(target) ? target : target.index),
            showCustomAsseertMessage
                ? prefix + `for source index: ${isNumber(target) ? target : target.index}`
                : void 0
        ).toBeTruthy()
    }
}

// 断言嵌入语言块的描述信息
// Assert the description information of the embedded language blocks
function assertEmbeddedLangDescriptor(node: TemplateNode) {
    const contentNode = node.children[0]?.content[0]
    if (/[jt]s$/.test(node.tag)) {
        if (node.loc.start.index === inputDescriptor.script.startTagOpenRange[0]) {
            expect(inputDescriptor.script).toEqual<ScriptDescriptor>({
                existing: true,
                isTS: node.tag.endsWith("ts"),
                code: contentNode ? contentNode.value : "",
                startTagOpenRange: getRangeByLocation(getStartTagOpenLoc(node)),
                lineCount: contentNode
                    ? contentNode.loc.end.line - contentNode.loc.start.line + 1
                    : 1,
                loc: contentNode ? contentNode.loc : getLocByIndex(node.startTagEndPos.index)
            })
        }
    } else {
        for (const item of inputDescriptor.styles) {
            if (item.loc.start.index === node.startTagEndPos.index) {
                expect(item).toEqual<StyleDescriptor>({
                    lang: node.tag.slice(5),
                    code: contentNode ? contentNode.value : "",
                    startTagOpenRange: getRangeByLocation(getStartTagOpenLoc(node)),
                    global: !!node.attributes.find(attr => attr.name.raw === "global"),
                    loc: contentNode ? contentNode.loc : getLocByIndex(node.startTagEndPos.index)
                })
            }
        }
    }
}
