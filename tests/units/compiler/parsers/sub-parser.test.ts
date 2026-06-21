import ts from "typescript"

import { test, expect } from "vitest"
import {
    parseScript,
    parseExpression,
    parseContextPattern
} from "../../../../src/compiler/parser/script"
import {
    parseDirectiveValue,
    parseDirectiveValueStandalone
} from "../../../../src/compiler/parser/directive"
import { inputDescriptor } from "../../../../src/compiler/state"
import { parseTemplateTesting } from "../../../../src/util/testing/sundry"
import { parseEventFlag, parseEventFlagStandalone } from "../../../../src/compiler/parser/event"

function getFirstAttribute(source: string) {
    return parseTemplateTesting(source)[0].attributes[0]
}

test("Function: parseDirectiveValue", () => {
    const htmlDirective = getFirstAttribute(`<div #html={expr}></div>`)
    const forDirective = getFirstAttribute(`<div #for={item of list}></div>`)
    const slotDirective = getFirstAttribute(`<div #slot={ctx from "header"}></div>`)

    const forRet = parseDirectiveValue(forDirective)
    expect(forRet.base.trim()).toBe("list")
    expect(forRet.patterns.length).toBe(1)
    expect(forRet.keywordIndex).toBeGreaterThan(-1)

    const slotRet = parseDirectiveValue(slotDirective)
    expect(slotRet.base.trim()).toBe('"header"')
    expect(slotRet.patterns.length).toBe(1)

    const htmlRet = parseDirectiveValue(htmlDirective)
    expect(htmlRet.keywordIndex).toBe(-1)
    expect(htmlRet.base).toBe("expr")
})

test("Function: parseDirectiveValueStandalone collects parse messages", () => {
    const directive = getFirstAttribute(`<div #for={{} of list}></div>`)
    const ret = parseDirectiveValueStandalone(directive)
    expect(ret.patterns.length).toBe(1)
    expect(ret.messages).toBeUndefined()
})

test("Function: parseEventFlag", () => {
    const plainEvent = getFirstAttribute(`<button @click={handler}></button>`)
    const keyboardEvent = getFirstAttribute(`<div @keydown|ctrl|enter|once={handler}></div>`)

    const plainRet = parseEventFlag(plainEvent)
    expect(plainRet.eventName).toBe("@click")
    expect(plainRet.generalFlag.items.length).toBe(0)
    expect(plainRet.wrapperFlag.items.length).toBe(0)

    const keyboardRet = parseEventFlag(keyboardEvent)
    expect(keyboardRet.eventName).toBe("@keydown")
    expect(keyboardRet.generalFlag.items.map(item => item.name)).toContain("once")
    expect(keyboardRet.wrapperFlag.items.map(item => item.name)).toContain("ctrl")
    expect(keyboardRet.wrapperFlag.items.map(item => item.name)).toContain("enter")
})

test("Function: parseEventFlagStandalone collects warnings and errors", () => {
    const event = getFirstAttribute(`<div @click|passive|prevent|stop|stop|enter|={handler}></div>`)
    const ret = parseEventFlagStandalone(event)
    expect(ret.messages?.length).toBeGreaterThan(0)
    expect(ret.messages?.some(item => item.type === "warning")).toBe(true)
    expect(ret.messages?.some(item => item.type === "error")).toBe(true)
})

test("Function: parseContextPattern", () => {
    const pattern = parseContextPattern("a, b", 0)
    const invalid = parseContextPattern("a + b", 0)
    expect(pattern?.elements.length).toBe(2)
    expect(pattern?.elements[0]?.getStart()).toBe(0)
    expect(invalid).toBeNull()
})

test("Function: parseExpression and parseScript", () => {
    parseTemplateTesting("<lang-js>let a = 1</lang-js>")
    const scriptStartIndex = inputDescriptor.script.loc.start.index

    expect(parseExpression("a + b", scriptStartIndex)).toBeTruthy()
    expect(() => parseExpression("a +", scriptStartIndex)).toThrow()

    parseTemplateTesting("<lang-js>let a = 1</lang-js>", { recover: true })
    expect(parseExpression("a +", inputDescriptor.script.loc.start.index)).toBeNull()

    parseTemplateTesting("<lang-ts>const count: number = 1</lang-ts>")
    expect(parseScript("const count: number = 1")?.kind).toBe(ts.SyntaxKind.SourceFile)
})
