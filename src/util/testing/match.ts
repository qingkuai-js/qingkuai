import type {
    ASTLocation,
    ASTPosition,
    TemplateNode,
    StyleDescriptor,
    ScriptDescriptor
} from "#type-declarations/compiler"
import type {
    ExpectedEffect,
    ExpectedTemplateNode,
    ExpectedCompileMessage
} from "#type-declarations/testing"
import type {
    Effect,
    ProxyWrapper,
    Subscription,
    AccessorWrapper
} from "#type-declarations/runtime"
import type { LinkedListNode } from "../../runtime/data-struct/linked-list"

import {
    getLocByIndex,
    getRangeByLocation,
    isPositionFlagSetInLoc,
    isPositionFlagSetAtIndex
} from "../compiler/position"
import { expect, vi } from "vitest"
import { isNumber } from "../shared/assert"
import { NIL } from "../../runtime/constants"
import { isDeepStrictEqual } from "node:util"
import { isReactive } from "../runtime/assert"
import { objectAssign } from "../shared/aliases"
import { PositionFlag } from "../../compiler/enums"
import { getStartTagOpenLoc } from "../compiler/template"
import { newTemplateNode } from "../../compiler/parser/template"
import { inputDescriptor, messages } from "../../compiler/state"
import { getLastElem, replaceEachItems } from "../shared/arrays"
import { LinkedList } from "../../runtime/data-struct/linked-list"
import { EFFECT_DISABLED, TIMING_SYNC, WRAPPER } from "../../runtime/reactivity/constants"

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
            children: nodeList[i].children
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

// 匹配验证编译消息列表
// Match and validate the compile message list
export function matchCompileMessages(expectedMessages: ExpectedCompileMessage[]) {
    for (let i = 0; i < messages.length; i++) {
        const [item, expected] = [messages[i], expectedMessages[i]]
        expect(item.type).toBe(expected.type)
        expect(item.value.message).toBe(expected.value)
        expect([item.value.loc.start.index, item.value.loc.end.index]).toEqual(expected.range)
    }
    expect(messages.length).toBe(expectedMessages.length)
}

// 通过数组创建双向链表
// Create a bidirectional linked list from an array
export function createLinkedListFromArray<T>(arr: T[]): LinkedList<T> {
    const ret = new LinkedList<T>()
    for (const item of arr) {
        ret.insert(item)
    }
    return ret
}

// 获取双向链表中指定索引的节点
// Get the node at the specified index in the bidirectional linked list
export function getIndexedLinkedListNode<T>(list: LinkedList<T>, index: number) {
    for (let node = list.head; node; ) {
        if (index === 0) {
            return node
        }
        if (--index < 0) {
            return
        }
        node = node.next
    }
}

// 匹配验证双向列表节点列表
// Match and validate the bidirectional linked list node list
export function matchLinkedList<T>(list: LinkedList<T>, expected: T[]) {
    const nodes: LinkedListNode<T>[] = []
    expect(list.size).toBe(expected.length)

    for (let node = list.head; node; ) {
        nodes.push(node)
        node = node.next
    }
    if (nodes.length) {
        expect(nodes[0]).toBe(list.head)
        expect(getLastElem(nodes)).toBe(list.tail)
    }
    for (let i = 0; i < nodes.length; i++) {
        expect(nodes[i].data).toEqual(expected[i])
        expect(nodes[i].prev).toBe(nodes[i - 1] ?? NIL)
        expect(nodes[i].next).toBe(nodes[i + 1] ?? NIL)
    }
}

// 基于 vi.spyOn 创建警告信息的捕获验证器
// Create a warning-capturing validator based on vi.spyOn
export function createWarningMatcher() {
    const warningArgs: any[] = []
    return objectAssign(
        vi.spyOn(console, "warn").mockImplementation((...args) => {
            replaceEachItems(warningArgs, args)
        }),
        {
            args: warningArgs
        }
    )
}

// 匹配全局：未捕获的异常/未处理的 rejection
// Match global: uncaught exceptions / unhandled rejections
export function matchGlobalError(pattern: string | RegExp, isRejection = false) {
    let catched = false
    const handler = (err: any) => {
        catched = true
        expect(err.message).toMatch(pattern)
    }
    const eventName = isRejection ? "unhandledRejection" : "uncaughtException"
    return (
        process.on(eventName, handler),
        () => {
            expect(catched).toBeTruthy()
            process.off(eventName, handler)
        }
    )
}

// 检查副作用与其他数据结构间的依赖关系
// Check dependance manager between the effect and other data struct
export function checkEffectDependaceManager(effect: Effect, expected: ExpectedEffect) {
    expect(effect.t).toBe(expected.timing)
    expect(effect.c).toBe(expected.cleaner)
    expect(effect.d).toBe(expected.destruction)

    const checkLink = (effect: Effect, sub: Subscription) => {
        expect(effect.k.map(link => link.s).includes(sub)).toBeTruthy()
        expect(sub.k.map(link => link.e).includes(effect)).toBeTruthy()
    }

    if (effect.d?.e) {
        expect(effect.d.e.includes(effect)).toBeTruthy()
    }
    if (expected.destroyed) {
        expect(effect.l & EFFECT_DISABLED).toBeTruthy()
    }
    for (const item of expected.dependencies || []) {
        const keyInWrapper = effect.t === TIMING_SYNC ? "s" : "a"
        if (isReactive(item)) {
            const wrapper = item[WRAPPER] as AccessorWrapper
            checkLink(effect, wrapper[keyInWrapper]!)
        } else {
            const [value, ...properties] = item
            const wrapper = value[WRAPPER] as ProxyWrapper
            for (const property of properties) {
                checkLink(effect, wrapper[keyInWrapper]!.get(property)!)
            }
        }
    }
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
    const hasContent = node.content.length === 1
    if (/[jt]s$/.test(node.tag)) {
        if (node.loc.start.index === inputDescriptor.script.startTagOpenRange[0]) {
            expect(inputDescriptor.script).toEqual<ScriptDescriptor>({
                existing: true,
                isTS: node.tag.endsWith("ts"),
                code: hasContent ? node.content[0].value : "",
                startTagOpenRange: getRangeByLocation(getStartTagOpenLoc(node)),
                lineCount: hasContent
                    ? node.content[0].loc.end.line - node.content[0].loc.start.line + 1
                    : 1,
                loc: hasContent ? node.content[0].loc : getLocByIndex(node.startTagEndPos.index)
            })
        }
    } else {
        for (const item of inputDescriptor.styles) {
            if (item.loc.start.index === node.startTagEndPos.index) {
                expect(item).toEqual<StyleDescriptor>({
                    lang: node.tag.slice(5),
                    code: hasContent ? node.content[0].value : "",
                    startTagOpenRange: getRangeByLocation(getStartTagOpenLoc(node)),
                    loc: hasContent ? node.content[0].loc : getLocByIndex(node.startTagEndPos.index)
                })
            }
        }
    }
}
