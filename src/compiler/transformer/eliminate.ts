import ts from "typescript"

import { CodeEditor } from "./editor"
import { analyzeResult, generateIdentifier, inputDescriptor } from "../state"

export function eliminate(editor: CodeEditor) {
    for (const decl of analyzeResult.script.importDeclarations) {
        editor.remove(decl.getFullStart(), decl.getEnd())
    }

    for (const statement of analyzeResult.script.exportStatements) {
        switch (statement.kind) {
            case ts.SyntaxKind.ExportAssignment:
            case ts.SyntaxKind.ExportDeclaration: {
                editor.remove(statement.getFullStart(), statement.getEnd())
                break
            }
            default: {
                if (ts.canHaveModifiers(statement)) {
                    for (const modifier of ts.getModifiers(statement) ?? []) {
                        if (
                            modifier.kind === ts.SyntaxKind.ExportKeyword ||
                            modifier.kind === ts.SyntaxKind.DefaultKeyword
                        ) {
                            editor.remove(modifier.getStart(), modifier.getEnd())
                        }
                    }
                }
                break
            }
        }
    }

    if (!inputDescriptor.options.checkMode) {
        const internalId = generateIdentifier.internal
        const { usedIntrinsicVars } = analyzeResult.script
        const defaultsCall = analyzeResult.script.defaultsCall
        for (const node of analyzeResult.script.eliminatedNodes) {
            if (
                defaultsCall &&
                node === defaultsCall &&
                defaultsCall.arguments.length &&
                ["props", "refs"].some(s => usedIntrinsicVars.has(s))
            ) {
                editor.replace(
                    defaultsCall.expression.getStart(),
                    defaultsCall.expression.getEnd(),
                    `${internalId}.applyDefaults`
                )
            } else {
                editor.remove(node.getStart(), node.getEnd())
            }
        }
    }
}
