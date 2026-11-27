import { test, expect } from "vitest";

import { compile } from "../../../../../src/compiler/compile";
import { parseScript } from "../../../../../src/compiler/parser/script";
import { formatSourceCode } from "../../../../../src/util/shared/sundry";

function compileRuntime(source: string, debug: boolean, interpretiveComments = false) {
    const result = compile(formatSourceCode(source), { debug, interpretiveComments });
    expect(result.messages.filter(item => item.type === "error")).toEqual([]);
    expect(() => parseScript(result.code)).not.toThrow();
    return result.code;
}

test("Plain row materializes identifier patterns only in debug mode", () => {
    const source = `
        <lang-js>let rows = [1]</lang-js>
        <div #for={item, index of rows}>{item}{index}</div>
    `;
    const debugCode = compileRuntime(source, true);
    expect(debugCode).toContain("let item, index;");
    expect(debugCode).toContain("([item, index] = [v.m, v.x])");
    expect(debugCode).toContain("_ctx1.m");

    const prodCode = compileRuntime(source, false);
    expect(prodCode).not.toContain("let item");
    expect(prodCode).not.toContain("= [v.m, v.x]");
    expect(prodCode).toContain("_ctx1.m");
});

test("Plain row declares only destructured names in production", () => {
    const source = `
        <lang-js>let rows = [{ a: 1 }]</lang-js>
        <div #for={{ a }, index of rows}>{a}{index}</div>
    `;
    const debugCode = compileRuntime(source, true);
    expect(debugCode).toContain("let a, index;");
    expect(debugCode).toContain("([{ a }, index] = [v.m, v.x])");

    const prodCode = compileRuntime(source, false);
    expect(prodCode).toContain("let a;");
    expect(prodCode).toContain("([{ a }] = [v.m])");
    expect(prodCode).not.toContain("let a, index");
});

test("Plain row keeps unreferenced identifier patterns fresh in debug mode", () => {
    const code = compileRuntime(
        `
            <lang-js>let rows = [{ a: 1 }]</lang-js>
            <div #for={{ a }, index of rows}>{a}</div>
        `,
        true,
        true,
    );
    expect(code).toContain("([{ a }, index] = [v.m, v.x])");
    expect(code).toContain("USES_INDEX");
});

test("Plain row does not depend on the omitted item pattern", () => {
    const source = `
        <lang-js>let rows = [1]</lang-js>
        <div #for={, index of rows}>{index}</div>
    `;
    const prodCode = compileRuntime(source, false, true);
    expect(prodCode).not.toContain("USES_ITEM");
    expect(prodCode).toContain("USES_INDEX");
    expect(prodCode).not.toContain("= [v.m");

    const debugCode = compileRuntime(source, true);
    expect(debugCode).toContain("([, index] = [, v.x])");
});

test("Non-plain row mirrors identifier patterns only in debug mode", () => {
    const source = `
        <lang-js>let rows = [1]</lang-js>
        <div #for={item, index of rows}>{item}{index}<Comp /></div>
    `;
    const debugCode = compileRuntime(source, true);
    expect(debugCode).toContain("let item, index;");
    expect(debugCode).toContain("item = _ctx1.m.$;");
    expect(debugCode).toContain("index = _ctx1.x.$;");

    const prodCode = compileRuntime(source, false);
    expect(prodCode).not.toContain("let item");
    expect(prodCode).not.toContain("item = _ctx1.m.$");
    expect(prodCode).toContain("_ctx1.m.$");
});

test("Non-plain row mirrors only unreferenced identifier patterns in debug mode", () => {
    const source = `
        <lang-js>let rows = [{ a: 1 }]</lang-js>
        <div #for={{ a }, index of rows}>{a}<Comp /></div>
    `;
    const debugCode = compileRuntime(source, true);
    expect(debugCode).toContain("let a, index;");
    expect(debugCode).toContain("index = _ctx1.x.$;");
    expect(debugCode).not.toContain("a = _ctx1.m.$;");

    const prodCode = compileRuntime(source, false);
    expect(prodCode).not.toContain("let a");
});

test("Non-plain row destructures the right channel for omitted item", () => {
    const source = `
        <lang-js>let rows = [{ a: 1 }]</lang-js>
        <div #for={, { a } of rows}>{a}<Comp /></div>
    `;
    const prodCode = compileRuntime(source, false);
    expect(prodCode).toContain("const { a } = _ctx1.x.$;");
    expect(prodCode).not.toContain("const  =");

    const debugCode = compileRuntime(source, true);
    expect(debugCode).toContain("const { a } = _ctx1.x.$;");
    expect(debugCode).not.toContain("const  =");
});
