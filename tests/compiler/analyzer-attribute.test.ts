import type { TemplateNodeAttributes } from "../types"

import { warnSpy } from "../vi"
import { test, describe, expect, afterEach } from "vitest"
import { parseTemplate } from "../../compiler/parser/template"
import { filterDuplicateAttr, findForItemDestructuringStr } from "../../compiler/analyzer/attribute"

const wranMsg = (tag: string, type: string, item: string) =>
    `Duplicate ${type} item(${item}) for ${tag} tag, the latter one has been applied according to the priority.`

afterEach(() => {
    warnSpy.mockClear()
})

describe("filterDuplicateAttr functions", () => {
    test("general tag with duplicate class", () => {
        const tn = parseTemplate(
            `<div class="a" class="b" !class="c" !class="d" class="e"></div>`
        )[0]
        expect(filterDuplicateAttr(tn.attributes, "div", false)).toEqual<TemplateNodeAttributes>([
            {
                key: "!class",
                value: `["e", c, d]`
            }
        ])
        expect(warnSpy).toHaveBeenCalledTimes(2)
        for (let i = 1; i <= 2; i++) {
            expect(warnSpy).toHaveBeenNthCalledWith(i, wranMsg("div", "attribute", "class"))
        }
    })

    test("component tag with duplicate class", () => {
        const tn = parseTemplate(
            `<Div class="a" class="b" !class="c" !class="d" class="e"></Div>`
        )[0]
        expect(filterDuplicateAttr(tn.attributes, "Div", true)).toEqual<TemplateNodeAttributes>([
            {
                key: "class",
                value: `"e"`
            }
        ])
        expect(warnSpy).toBeCalledTimes(4)
        for (let i = 1; i <= 4; i++) {
            expect(warnSpy).toHaveBeenNthCalledWith(i, wranMsg("Div", "attribute", "class"))
        }
    })

    test("component tag with reference class", () => {
        const tn = parseTemplate(`<I !id="id" id="i" &class = "value" ></I>`)[0]
        expect(filterDuplicateAttr(tn.attributes, "I", true)).toEqual<TemplateNodeAttributes>([
            {
                key: "id",
                value: `"i"`
            },
            {
                key: "&class",
                value: "value"
            }
        ])
        expect(warnSpy).toBeCalledTimes(1)
        expect(warnSpy).toBeCalledWith(wranMsg("I", "attribute", "id"))
    })

    test("general tag with duplicate directive (and attribute)", () => {
        const tn = parseTemplate(
            `<p  id="1" !id="id" #for="item, index in arr" #for=" item,index in arr2" ></p>`
        )[0]
        expect(filterDuplicateAttr(tn.attributes, "p", false)).toEqual<TemplateNodeAttributes>([
            {
                key: "#for",
                value: " item,index in arr2"
            },
            {
                key: "!id",
                value: "id"
            }
        ])
        expect(warnSpy).toBeCalledTimes(2)
        expect(warnSpy).toHaveBeenNthCalledWith(1, wranMsg("p", "attribute", "id"))
        expect(warnSpy).toHaveBeenNthCalledWith(2, wranMsg("p", "directive", "#for"))
    })

    test("component tag with duplicate directive (and attribute)", () => {
        const tn = parseTemplate(
            `<P  #for="item, index in arr" #for=" item,index in arr2" !id="id" id="1"></P>`
        )[0]
        expect(filterDuplicateAttr(tn.attributes, "P", true)).toEqual<TemplateNodeAttributes>([
            {
                key: "#for",
                value: " item,index in arr2"
            },
            {
                key: "id",
                value: `"1"`
            }
        ])
        expect(warnSpy).toBeCalledTimes(2)
        expect(warnSpy).toHaveBeenNthCalledWith(1, wranMsg("P", "directive", "#for"))
        expect(warnSpy).toHaveBeenNthCalledWith(2, wranMsg("P", "attribute", "id"))
    })

    test("general tag with duplicate attribute(reference an dynamic)", () => {
        const tn = parseTemplate(`<span &auto="value" !auto="value"></span>`)[0]
        expect(filterDuplicateAttr(tn.attributes, "span", false)).toEqual<TemplateNodeAttributes>([
            {
                key: "!auto",
                value: "value"
            }
        ])
        expect(warnSpy).toBeCalledTimes(1)
        expect(warnSpy).toBeCalledWith(wranMsg("span", "attribute", "auto"))
    })

    test("component tag with duplicate attribute(reference an dynamic)", () => {
        const tn = parseTemplate(`<Span !auto="value"  &auto="value"  ></Span >`)[0]
        expect(filterDuplicateAttr(tn.attributes, "Span", true)).toEqual<TemplateNodeAttributes>([
            {
                key: "&auto",
                value: "value"
            }
        ])
        expect(warnSpy).toBeCalledTimes(1)
        expect(warnSpy).toBeCalledWith(wranMsg("Span", "attribute", "auto"))
    })

    test("whether attribute is sorted in the correct order", () => {
        const tn = parseTemplate(
            `<div class="a" id="test" #if="a" #for="a" #await ="a" #key="a"></div>`
        )[0]
        expect(filterDuplicateAttr(tn.attributes, "div", false)).toEqual<TemplateNodeAttributes>([
            {
                key: "#await",
                value: "a"
            },
            {
                key: "#if",
                value: "a"
            },
            {
                key: "#for",
                value: "a"
            },
            {
                key: "#key",
                value: "a"
            },
            {
                key: "!class",
                value: '["a"]'
            },
            {
                key: "id",
                value: '"test"'
            }
        ])
    })

    test(`whether empty compile-related attribute will cause an error`, () => {
        let tn = parseTemplate(`<div !></div>`)[0]
        expect(() => filterDuplicateAttr(tn.attributes, "div", false)).toThrow(
            "The dynamic attribute must be specified a name."
        )

        tn = parseTemplate("<div &></div>")[0]
        expect(() => filterDuplicateAttr(tn.attributes, "div", false)).toThrow(
            "The reference attribute must be specified a name."
        )

        tn = parseTemplate("<div @></div>")[0]
        expect(() => filterDuplicateAttr(tn.attributes, "div", false)).toThrow(
            "The event listener must be specified a name."
        )

        tn = parseTemplate("<div #></div>")[0]
        expect(() => filterDuplicateAttr(tn.attributes, "div", false)).toThrow(
            "The directive must be specified a name."
        )
    })

    test("whether an error occurs when using combination of directive that cannot be used simultaneously", () => {
        let tn = parseTemplate(`<div #if="a" #elif="a"></div>`)[0]
        expect(() => filterDuplicateAttr(tn.attributes, "div", false)).toThrow(
            "Directives(#if, #elif) can not be used simultaneously."
        )

        tn = parseTemplate(`<div #if="a" #else></div>`)[0]
        expect(() => filterDuplicateAttr(tn.attributes, "div", false)).toThrow(
            "Directives(#if, #else) can not be used simultaneously."
        )

        tn = parseTemplate(`<div #else #elif="a"></div>`)[0]
        expect(() => filterDuplicateAttr(tn.attributes, "div", false)).toThrow(
            "Directives(#else, #elif) can not be used simultaneously."
        )

        tn = parseTemplate(`<div #then #catch></div>`)[0]
        expect(() => filterDuplicateAttr(tn.attributes, "div", false)).toThrow(
            "Directives(#then, #catch) can not be used simultaneously."
        )
    })

    test("whether the compile-related attribute that must pass a value cause an error when no value is passed", () => {
        let tn = parseTemplate(`<div !a></div>`)[0]
        expect(() => filterDuplicateAttr(tn.attributes, "div", false)).toThrow(
            "The dynamic attribute(!a) must have a value."
        )

        tn = parseTemplate(`<input &a />`)[0]
        expect(() => filterDuplicateAttr(tn.attributes, "input", false)).toThrow(
            "The reference attribute(&a) must have a value."
        )

        const mustPassValueDirectives = ["if", "await", "for", "key", "elif"]
        mustPassValueDirectives.forEach(item => {
            tn = parseTemplate(`<div #${item}></div>`)[0]
            expect(() => filterDuplicateAttr(tn.attributes, "div", false)).toThrow(
                `The directive(#${item}) must have a value.`
            )
        })

        tn = parseTemplate(`<div @click></div>`)[0]
        expect(() => filterDuplicateAttr(tn.attributes, "div", false)).toThrow(
            `The event listener(@click) must have a value.`
        )
        tn = parseTemplate(`<div #if></div>`)[0]
        expect(() => filterDuplicateAttr(tn.attributes, "div", false)).toThrow(
            `The directive(#if) must have a value.`
        )
    })
})

test("whether [ findForItemDestructuringStr] could find out the item part of for directive constructuring string", () => {
    const sources = [
        `{ a }, index`,
        `{ a, b }, index`,
        `{ '{a': a }`,
        `{ a, b: [b] } `,
        `{a:[a, b,...rest]}`,
        `{ a: { a }, b }  ,  index`,
        `{ a: { a: { a } } }  `,
        `{ a: /** { */ { a }, b }  `,
        `{ a, b: { b }, ...rest }  `,
        `[a]`,
        `[a, b, c]  `,
        `[a, [b, [c, [d]]]] `,
        `[a, ...rest] `
    ]
    const expects = [
        `{ a }`,
        `{ a, b }`,
        `{ '{a': a }`,
        `{ a, b: [b] }`,
        `{a:[a, b,...rest]}`,
        `{ a: { a }, b }`,
        `{ a: { a: { a } } }`,
        `{ a: /** { */ { a }, b }`,
        `{ a, b: { b }, ...rest }`,
        `[a]`,
        `[a, b, c]`,
        `[a, [b, [c, [d]]]]`,
        `[a, ...rest]`,
        ``
    ]
    sources.forEach((source, index) => {
        expect(findForItemDestructuringStr(source)).toBe(expects[index])
    })
})
