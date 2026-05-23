import ts from "typescript"

import { inputDescriptor } from "../state"
import { walkTsNode } from "../ts-ast/walk"
import { any } from "../../util/shared/sundry"
import { hasParseError } from "../ts-ast/assert"
import { isString } from "../../util/shared/assert"

export function parseContextPattern(source: string) {
    const sourceFile = createSourceFile(`const [${source}]=_`, 0, true)
    if (hasParseError(sourceFile)) {
        return null
    }

    const statement = sourceFile.statements[0]
    if (!ts.isVariableStatement(statement)) {
        return null
    }

    const firstDeclaration = statement.declarationList.declarations[0]
    if (!ts.isArrayBindingPattern(firstDeclaration.name)) {
        return null
    }
    walkTsNode(firstDeclaration.name, node => {
        const start = node.getStart()
        const fullStart = node.getFullStart()
        node.getStart = () => start - 7
        node.getFullStart = () => fullStart - 7
    })
    return firstDeclaration.name
}

export function parseScript(source: string) {
    return createSourceFile(source, inputDescriptor.script.loc.start.index)
}

export function parseExpression(source: string, startSourceIndex: number) {
    const sourceFile = createSourceFile(`_=(${source})`, startSourceIndex)
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
    return expression.right.expression
}

function createSourceFile(
    source: string,
    startSourceIndex: number,
    recover = inputDescriptor.options.checkMode
) {
    const sourceFile = ts.createSourceFile(
        "",
        source,
        ts.ScriptTarget.ESNext,
        true,
        inputDescriptor.script.isTS ? ts.ScriptKind.TS : ts.ScriptKind.JS
    )
    if (hasParseError(sourceFile) && !recover) {
        let message = "Syntax error"
        const firstDiagnostic: ts.Diagnostic = any(sourceFile).parseDiagnostics[0]
        if (isString(firstDiagnostic.messageText)) {
            message = firstDiagnostic.messageText
        } else {
            message = firstDiagnostic.messageText.messageText
        }
        throw new SyntaxError(message, {
            cause: {
                pos: startSourceIndex + firstDiagnostic.start! + startSourceIndex
            }
        })
    }
    return sourceFile
}
