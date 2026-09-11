import type TS from "typescript"

import ts from "typescript"

import { expect } from "vitest"
import { parseTemplateTesting } from "./sundry"
import { formatSourceCode } from "../shared/sundry"
import { walkTsNode } from "../../compiler/ts-ast/walk"
import { parseScript } from "../../compiler/parser/script"

export function parseTsScript(source: string) {
    parseTemplateTesting("<lang-ts>const _ = 0</lang-ts>")
    return parseScript(formatSourceCode(source))
}

export function findIdentifier(sourceFile: TS.SourceFile, name: string): TS.Identifier {
    let result: TS.Identifier | null = null
    walkTsNode(sourceFile, node => {
        if (ts.isIdentifier(node) && node.text === name) {
            result = node
            return true
        }
    })
    expect(result, `identifier "${name}" not found`).toBeTruthy()
    return result!
}
