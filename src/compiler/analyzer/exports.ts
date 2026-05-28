import ts from "typescript"

import { analyzeResult } from "../state"
import { InvalidExportStatement } from "../message/error"
import { walkBindingNameIdentifiers } from "../ts-ast/walk"
import { getScriptLocByNode } from "../../util/compiler/position"

export function analyzeExports(sourceFile: ts.SourceFile) {
    for (const statement of sourceFile.statements) {
        switch (statement.kind) {
            // export = ...
            // export default ...
            case ts.SyntaxKind.ExportAssignment: {
                const exportAssignment = statement as ts.ExportAssignment
                const exportFormat = exportAssignment.isExportEquals
                    ? "Assignment export"
                    : "Default export"
                analyzeResult.script.exportStatements.push(exportAssignment)
                InvalidExportStatement(getScriptLocByNode(statement), exportFormat)
                break
            }

            case ts.SyntaxKind.ExportDeclaration: {
                const exportDeclaration = statement as ts.ExportDeclaration
                analyzeResult.script.exportStatements.push(exportDeclaration)

                const moduleSpecifier = exportDeclaration.moduleSpecifier
                const hasValidModuleSpecifier =
                    !!moduleSpecifier && moduleSpecifier.pos !== moduleSpecifier.end

                if (!exportDeclaration.exportClause) {
                    if (hasValidModuleSpecifier) {
                        InvalidExportStatement(getScriptLocByNode(statement), "Re-export")
                    }
                    break
                }

                // 不完整的输入: `export * as ns`
                // Incomplete input: `export * as ns`
                if (ts.isNamespaceExport(exportDeclaration.exportClause)) {
                    InvalidExportStatement(
                        getScriptLocByNode(statement),
                        hasValidModuleSpecifier ? "Re-export" : "Namespace export"
                    )
                    break
                }

                if (hasValidModuleSpecifier) {
                    InvalidExportStatement(getScriptLocByNode(statement), "Re-export")
                    break
                }

                if (exportDeclaration.isTypeOnly) {
                    InvalidExportStatement(getScriptLocByNode(statement), "Type export")
                    break
                }

                for (const element of exportDeclaration.exportClause.elements) {
                    if (element.isTypeOnly) {
                        InvalidExportStatement(getScriptLocByNode(element), "Type export")
                        continue
                    }
                    analyzeResult.script.exportedBindings.push({
                        local: element.propertyName?.text ?? element.name.text,
                        exported: element.name.text
                    })
                }
                break
            }

            default: {
                if (!ts.canHaveModifiers(statement)) {
                    break
                }

                if (
                    !statement.modifiers?.some(mod => {
                        return mod.kind === ts.SyntaxKind.ExportKeyword
                    })
                ) {
                    break
                }
                analyzeResult.script.exportStatements.push(statement)

                if (
                    statement.modifiers?.some(mod => {
                        return mod.kind === ts.SyntaxKind.DefaultKeyword
                    })
                ) {
                    InvalidExportStatement(getScriptLocByNode(statement), "Default export")
                    break
                }

                if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
                    InvalidExportStatement(getScriptLocByNode(statement), "Type export")
                    break
                }

                if (
                    ts.isEnumDeclaration(statement) ||
                    ts.isClassDeclaration(statement) ||
                    ts.isModuleDeclaration(statement) ||
                    ts.isFunctionDeclaration(statement)
                ) {
                    if (statement.name) {
                        analyzeResult.script.exportedBindings.push({
                            local: statement.name.text,
                            exported: statement.name.text
                        })
                    }
                    break
                }

                if (ts.isVariableStatement(statement)) {
                    for (const declaration of statement.declarationList.declarations) {
                        walkBindingNameIdentifiers(declaration.name, id => {
                            analyzeResult.script.exportedBindings.push({
                                local: id.text,
                                exported: id.text
                            })
                        })
                    }
                }
                break
            }
        }
    }
}
