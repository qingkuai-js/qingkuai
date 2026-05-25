import ts from "typescript"

import { CodeEditor } from "./editor"
import { analyzeResult, inputDescriptor } from "../state"

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
                            editor.remove(modifier.getFullStart(), modifier.getEnd())
                        }
                    }
                }
                break
            }
        }
    }

    if (!inputDescriptor.options.checkMode) {
        for (const node of analyzeResult.script.eliminatedNodes) {
            editor.remove(node.getFullStart(), node.getEnd())
        }
    }
}
