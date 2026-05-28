import ts from "typescript"

import { expect, test } from "vitest"
import { hasParseError } from "../../../../../src/compiler/ts-ast/assert"

test("parse error detection", () => {
    const validSourceFile = ts.createSourceFile(
        "valid.ts",
        "const value = 1",
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
    )
    const invalidSourceFile = ts.createSourceFile(
        "invalid.ts",
        "const value =",
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
    )

    expect(hasParseError(validSourceFile)).toBeFalsy()
    expect(hasParseError(invalidSourceFile)).toBeTruthy()
})
