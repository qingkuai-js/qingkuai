import { test, expect } from "vitest";

import { formatSourceCode } from "../../../../../src/util/shared/sundry";
import { compileIntermediate } from "../../../../../src/compiler/compile";

function compileSource(source: string) {
    return formatSourceCode(source);
}

function getReturnObject(code: string) {
    const prefix = "return {";
    const componentStart = code.indexOf("const __qk__component");
    const returnStart = code.indexOf(prefix, componentStart);
    expect(returnStart).toBeGreaterThan(-1);
    return code.slice(returnStart + prefix.length, code.indexOf("}", returnStart));
}

test("Exported values are written into the component return object", () => {
    const result = compileIntermediate(
        compileSource(`
            <lang-ts>
                const v = 1
                export { v }
            </lang-ts>
            <div>{v}</div>
        `),
    );
    expect(getReturnObject(result.code).trim()).toBe("v,");
});

test("Type-only exports rejected by the compiler produce no lookup binding", () => {
    const result = compileIntermediate(
        compileSource(`
            <lang-ts>
                interface A { x: number }
                export type { A }
            </lang-ts>
            <div>hi</div>
        `),
    );
    expect(result.messages.some(m => m.type === "error")).toBe(true);
    expect(result.code).toContain("const __qk__component = (meta) => {}");
});

test("Type exports stay in the return object so the type checker can reject them", () => {
    const result = compileIntermediate(
        compileSource(`
            <lang-ts>
                interface A { x: number }
                export { A }
            </lang-ts>
            <div>hi</div>
        `),
    );
    expect(getReturnObject(result.code).trim()).toBe("A,");
});

test("Undeclared exports stay in the return object so the type checker can reject them", () => {
    const result = compileIntermediate(
        compileSource(`
            <lang-ts>
                export { notDeclared }
            </lang-ts>
            <div>hi</div>
        `),
    );
    expect(getReturnObject(result.code).trim()).toBe("notDeclared,");
});

test("Aliased exports keep the local identifier as the value", () => {
    const result = compileIntermediate(
        compileSource(`
            <lang-ts>
                const v = 1
                export { v as w }
            </lang-ts>
            <div>{v}</div>
        `),
    );
    expect(getReturnObject(result.code).trim()).toBe("w: v,");
});

test("String-literal export names are written as valid property keys", () => {
    const result = compileIntermediate(
        compileSource(`
            <lang-ts>
                const a = 1
                export { a as "x-y" }
            </lang-ts>
            <div>{a}</div>
        `),
    );
    expect(getReturnObject(result.code).trim()).toBe('"x-y": a,');
});

test("Imported value exports are written into the return object", () => {
    const result = compileIntermediate(
        compileSource(`
            <lang-ts>
                import { extValue } from "./ext"
                export { extValue }
            </lang-ts>
            <div>hi</div>
        `),
    );
    expect(getReturnObject(result.code).trim()).toBe("extValue,");
});

test("Declaration-site exports are written into the return object", () => {
    const result = compileIntermediate(
        compileSource(`
            <lang-ts>
                export const w = 1
            </lang-ts>
            <div>{w}</div>
        `),
    );
    expect(getReturnObject(result.code).trim()).toBe("w,");
});

test("Duplicate exported names are preserved for the type checker to report", () => {
    const result = compileIntermediate(
        compileSource(`
            <lang-ts>
                const a = 1
                const b = 2
                export { a as x, b as x }
            </lang-ts>
            <div>{a}</div>
        `),
    );
    expect(getReturnObject(result.code).trim()).toBe("x: a,\n        x: b,");
});

test("Export bindings are mapped back to their source identifiers", () => {
    for (const [source, entry, expectedName, after] of [
        [
            `
            <lang-ts>
                const value = 1
                export { value }
            </lang-ts>
            <div>{value}</div>
        `,
            "value,",
            "value",
            "export {",
        ],
        [
            `
            <lang-ts>
                const local = 1
                export { local as remote }
            </lang-ts>
            <div>{local}</div>
        `,
            "local,",
            "local",
            "export {",
        ],
    ] as const) {
        const formatted = compileSource(source);
        const result = compileIntermediate(formatted);
        const index = result.code.indexOf(entry, result.code.indexOf("const __qk__component"));
        expect(index).toBeGreaterThan(-1);
        expect(result.getSourceIndex(index)).toBe(
            formatted.indexOf(expectedName, formatted.indexOf(after)),
        );
    }
});

test("Aliased export names are mapped back to the exported identifier", () => {
    const formatted = compileSource(`
        <lang-ts>
            const local = 1
            export { local as remote }
        </lang-ts>
        <div>{local}</div>
    `);
    const result = compileIntermediate(formatted);
    const index = result.code.indexOf("remote", result.code.indexOf("const __qk__component"));
    expect(index).toBeGreaterThan(-1);
    expect(result.getSourceIndex(index)).toBe(
        formatted.indexOf("remote", formatted.indexOf("export {")),
    );
});

test("String-literal export names are mapped back to the export specifier", () => {
    const formatted = compileSource(`
        <lang-ts>
            const value = 1
            export { value as "x-y" }
        </lang-ts>
        <div>{value}</div>
    `);
    const result = compileIntermediate(formatted);
    const index = result.code.indexOf('"x-y"', result.code.indexOf("const __qk__component"));
    expect(index).toBeGreaterThan(-1);
    expect(result.getSourceIndex(index)).toBe(
        formatted.indexOf('"x-y"', formatted.indexOf("export {")),
    );
});
