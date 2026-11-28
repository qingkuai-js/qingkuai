import { test, expect } from "vitest";

import { formatSourceCode } from "../../../../../src/util/shared/sundry";
import { compileIntermediate } from "../../../../../src/compiler/compile";
import { parseScript } from "../../../../../src/compiler/parser/script";

function compileSource(source: string) {
    const result = compileIntermediate(formatSourceCode(source));
    expect(() => parseScript(result.code)).not.toThrow();
    return result;
}

// 压缩空白，避免断言依赖生成代码的缩进
function normalize(code: string) {
    return code.replace(/\s+/g, " ");
}

test("Interpolation-only default slot content is wrapped in a default function", () => {
    const result = compileSource(`
        <lang-js>import Comp from "./Comp.qk"; let options = ["a"]</lang-js>
        <Comp #for={option of options}>{option}</Comp>
    `);
    const code = normalize(result.code);
    expect(code).toContain("slots: { default: () => { option; }");
    expect(code).not.toContain("slots: { option;");
});

test("Static text-only default slot is still declared", () => {
    const result = compileSource(`
        <lang-js>import Comp from "./Comp.qk"</lang-js>
        <Comp>hello</Comp>
    `);
    expect(normalize(result.code)).toContain("slots: { default: () => {");
});

test("Text and interpolation parts share a single default slot function", () => {
    const result = compileSource(`
        <lang-js>import Comp from "./Comp.qk"; let n = 1</lang-js>
        <Comp>count: {n}</Comp>
    `);
    const code = normalize(result.code);
    expect(code).toContain("slots: { default: () => { n; }");
    expect(code).not.toContain("slots: { n;");
});

test("Whitespace-only component children do not declare a default slot", () => {
    const result = compileSource(`
        <lang-js>import Comp from "./Comp.qk"</lang-js>
        <Comp>

        </Comp>
    `);
    expect(normalize(result.code)).not.toContain("default: () =>");
});

test("Tagged child default slot is unchanged", () => {
    const result = compileSource(`
        <lang-js>import Comp from "./Comp.qk"; let n = 1</lang-js>
        <Comp><span>{n}</span></Comp>
    `);
    expect(normalize(result.code)).toContain("slots: { default: () => { n; }");
});

test("Named slots are not affected", () => {
    const result = compileSource(`
        <lang-js>import Comp from "./Comp.qk"; let n = 1</lang-js>
        <Comp><span #slot={"x"}>{n}</span></Comp>
    `);
    const code = normalize(result.code);
    expect(code).toContain('slots: { "x": () => { n; }');
    expect(code).not.toContain("default: () =>");
});

test("Text-only default slot is wrapped inside conditional blocks", () => {
    const result = compileSource(`
        <lang-js>import Comp from "./Comp.qk"; let ok = true; let n = 1</lang-js>
        <div #if={ok}><Comp>{n}</Comp></div>
    `);
    expect(normalize(result.code)).toContain("slots: { default: () => { n; }");
});

test("Same-named slots in exclusive branches emit one context object each", () => {
    const result = compileSource(`
        <lang-js>let ok = true; let a = 1; let b = 2</lang-js>
        <slot #if={ok} !value={a}></slot>
        <slot #else !value={b}></slot>
    `);
    const code = normalize(result.code);
    expect(code.match(/getTypeDelayMarking\("default", \{/g)?.length).toBe(2);
    expect(code).toContain('getTypeDelayMarking("default", { value: a })');
    expect(code).toContain('getTypeDelayMarking("default", { value: b })');
    expect(result.slotNames).toEqual(["default"]);
    expect(result.getTypeDelayInterIndexes.length).toBe(2);
});

test("Single slot with context emits one context object", () => {
    const result = compileSource(`
        <lang-js>let n = 1</lang-js>
        <slot !value={n} title="x"></slot>
    `);
    const code = normalize(result.code);
    expect(code).toContain('getTypeDelayMarking("default", { title: "x", value: n })');
    expect(result.getTypeDelayInterIndexes.length).toBe(1);
});

test("Slots without context still register their outlet names", () => {
    const result = compileSource(`
        <lang-js>let ok = true</lang-js>
        <slot #if={ok}></slot>
        <slot #else></slot>
    `);
    const code = normalize(result.code);
    expect(code.match(/getTypeDelayMarking\("default", \{\}\)/g)?.length).toBe(2);
    expect(result.slotNames).toEqual(["default"]);
    expect(result.getTypeDelayInterIndexes.length).toBe(2);
});

test("Named slot without context registers its outlet name", () => {
    const result = compileSource(`
        <slot name="footer"></slot>
    `);
    const code = normalize(result.code);
    expect(code).toContain('getTypeDelayMarking("footer", {})');
    expect(result.getTypeDelayInterIndexes.length).toBe(1);
});

test("Slot registry keeps every same-named slot node", () => {
    const result = compileSource(`
        <lang-js>let ok = true; let a = 1</lang-js>
        <slot #if={ok} !value={a}></slot>
        <slot #else></slot>
    `);
    expect(result.getSlotTemplateNodes("default").length).toBe(2);
    expect(result.getSlotTemplateNodes("unknown")).toEqual([]);
    expect(result.getSlotTemplateNodes("default")[0].tag).toBe("slot");
});
