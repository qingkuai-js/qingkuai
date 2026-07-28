import ts from "typescript"
import type { ParseDiatnosticDealtKind } from "#type-declarations/compiler"

import { walkTsNode } from "../ts-ast/walk"
import { any } from "../../util/shared/sundry"
import { hasParseError } from "../ts-ast/assert"
import { isString } from "../../util/shared/assert"
import { expressionParseErrorNoReportRE } from "../regular"
import { inputDescriptor, tsParsingDiagnostics } from "../state"

export function parseScript(source: string) {
    return createSourceFile(source, inputDescriptor.script.loc.start.index, () => {
        return inputDescriptor.options.checkMode ? "record" : "thrown"
    })
}

export function parseExpression(source: string, startSourceIndex: number) {
    const sourceFile = createSourceFile(`_=(${source})`, startSourceIndex - 3, msg => {
        if (expressionParseErrorNoReportRE.test(msg)) {
            return "ignore"
        }
        return inputDescriptor.options.checkMode ? "record" : "thrown"
    })
    if (hasParseError(sourceFile)) {
        return null
    }

    const statement = sourceFile.statements[0]
    if (!ts.isExpressionStatement(statement)) {
        return null
    }

    const expression = statement.expression
    if (
        !ts.isBinaryExpression(expression) ||
        !ts.isParenthesizedExpression(expression.right) ||
        expression.operatorToken.kind !== ts.SyntaxKind.EqualsToken
    ) {
        return null
    }
    return offsetStartAndEndGetter(expression.right.expression, -3)
}

export function parseContextPattern(source: string, startSourceIndex: number) {
    const sourceFile = createSourceFile(`const [${source}]=_`, startSourceIndex - 7, () => {
        return "ignore"
    })
    if (hasParseError(sourceFile)) {
        return null
    }

    const statement = sourceFile.statements[0]
    if (!ts.isVariableStatement(statement)) {
        return null
    }

    const firstDeclaration = statement.declarationList.declarations[0]
    if (
        !ts.isArrayBindingPattern(firstDeclaration.name) ||
        firstDeclaration.name.elements.some(item => {
            return ts.isBindingElement(item) && item.initializer
        })
    ) {
        return null
    }
    return offsetStartAndEndGetter(firstDeclaration.name, -7)
}

function offsetStartAndEndGetter<T extends ts.Node>(root: T, offset: number): T {
    walkTsNode(root, node => {
        const end = node.getEnd()
        const text = node.getText()
        const start = node.getStart()
        const fullStart = node.getFullStart()
        node.getText = () => text
        node.getEnd = () => end + offset
        node.getStart = () => start + offset
        node.getFullStart = () => fullStart + offset
    })
    return root
}

function createSourceFile(
    source: string,
    startSourceIndex: number,
    shouldThrow: (msg: string) => ParseDiatnosticDealtKind
) {
    const sourceFile = ts.createSourceFile(
        "",
        source,
        ts.ScriptTarget.ESNext,
        true,
        inputDescriptor.script.isTS ? ts.ScriptKind.TS : ts.ScriptKind.JS
    )
    if (hasParseError(sourceFile)) {
        let message = "Syntax error"
        const diagnostics: ts.Diagnostic[] = any(sourceFile).parseDiagnostics
        if (isString(diagnostics[0].messageText)) {
            message = diagnostics[0].messageText
        } else {
            message = diagnostics[0].messageText.messageText
        }
        switch (shouldThrow(message)) {
            case "thrown": {
                throw new SyntaxError(message, {
                    cause: {
                        pos: startSourceIndex + diagnostics[0].start!
                    }
                })
            }
            case "record": {
                for (const item of diagnostics) {
                    tsParsingDiagnostics.push({
                        ...item,
                        start: startSourceIndex + diagnostics[0].start!
                    })
                }
            }
        }
    }
    return sourceFile
}
