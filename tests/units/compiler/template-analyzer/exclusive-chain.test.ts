import { describe, test, expect } from "vitest";
import type { TemplateNode } from "../../../../src/types/compiler";

import { analyzeScript } from "../../../../src/compiler/analyzer/script";
import { parseTemplateTesting } from "../../../../src/util/testing/sundry";
import { analyzeTemplate } from "../../../../src/compiler/analyzer/template";
import { getTemplateNodeContext, walkTemplateNodes } from "../../../../src/util/compiler/template";

function analyze(source: string) {
    const nodes = parseTemplateTesting(source, { recover: true });
    analyzeScript();
    analyzeTemplate(nodes);
    return nodes;
}

function collectElements(nodes: TemplateNode[]) {
    const elements: TemplateNode[] = [];
    walkTemplateNodes(nodes, node => {
        if (node.tag) {
            elements.push(node);
        }
    });
    return elements;
}

function chainOf(node: TemplateNode) {
    return getTemplateNodeContext(node).exclusiveChain;
}

describe("Exclusive chain groups", () => {
    test("Branches of one chain share the chain head", () => {
        const elements = collectElements(
            analyze(`<div #if={a}></div><div #elif={b}></div><div #else></div>`),
        );
        expect(elements).toHaveLength(3);
        expect(chainOf(elements[0])).toBe(elements[0]);
        expect(chainOf(elements[1])).toBe(elements[0]);
        expect(chainOf(elements[2])).toBe(elements[0]);
    });

    test("Independent chains keep their own head", () => {
        const elements = collectElements(analyze(`<div #if={a}></div><div #if={b}></div>`));
        expect(chainOf(elements[0])).toBe(elements[0]);
        expect(chainOf(elements[1])).toBe(elements[1]);
        expect(chainOf(elements[1])).not.toBe(chainOf(elements[0]));
    });

    test("Await branches share the chain head", () => {
        const elements = collectElements(
            analyze(
                `<div #await={promise}></div><div #then={value}></div><div #catch={error}></div>`,
            ),
        );
        expect(chainOf(elements[1])).toBe(elements[0]);
        expect(chainOf(elements[2])).toBe(elements[0]);
    });

    test("In-place then/catch belongs to the await head", () => {
        const elements = collectElements(
            analyze(`<div #await={promise} #then={value}></div><div #catch={error}></div>`),
        );
        expect(chainOf(elements[0])).toBe(elements[0]);
        expect(chainOf(elements[1])).toBe(elements[0]);
    });

    test("Chain kind follows the directive priority on the same tag", () => {
        const thenChain = collectElements(
            analyze(`<div #await={promise} #if={ok}></div><div #then={value}></div>`),
        );
        expect(chainOf(thenChain[1])).toBe(thenChain[0]);

        const elseChain = collectElements(
            analyze(`<div #await={promise} #if={ok}></div><div #else></div>`),
        );
        expect(chainOf(elseChain[1])).toBeNull();
    });

    test("Text nodes between branches are ignored", () => {
        const elements = collectElements(analyze(`<div #if={a}></div>plain text<div #else></div>`));
        expect(chainOf(elements[1])).toBe(elements[0]);
    });

    test("Invalid continuations are not grouped", () => {
        const elements = collectElements(analyze(`<div #else></div><div #else></div>`));
        expect(chainOf(elements[0])).toBeNull();
        expect(chainOf(elements[1])).toBeNull();
    });

    test("Nested chains are grouped independently", () => {
        const elements = collectElements(
            analyze(`<div #if={a}><div #if={b}></div><div #else></div></div><div #else></div>`),
        );
        expect(elements).toHaveLength(4);
        expect(chainOf(elements[1])).toBe(elements[1]);
        expect(chainOf(elements[2])).toBe(elements[1]);
        expect(chainOf(elements[3])).toBe(elements[0]);
        expect(chainOf(elements[1])).not.toBe(elements[0]);
    });
});
