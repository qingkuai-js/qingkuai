import type { ExpectedCompileMessage } from "#type-declarations/testing"

import { expect } from "vitest"
import { messages } from "../../compiler/state"

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
