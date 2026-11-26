import type TS from "typescript";

import ts from "../ts-api";

import { analyzeResult } from "../state";
import { hasParseErrorInNode } from "../ts-ast/assert";
import { InvalidExportStatement } from "../message/error";
import { walkBindingNameIdentifiers } from "../ts-ast/walk";
import { getScriptLocByNode, getScriptRangeByNode } from "../../util/compiler/position";

export function analyzeExports(sourceFile: TS.SourceFile) {
    for (const statement of sourceFile.statements) {
        switch (statement.kind) {
            // export = ...
            // export default ...
            case ts.SyntaxKind.ExportAssignment: {
                const exportAssignment = statement as TS.ExportAssignment;
                const exportFormat = exportAssignment.isExportEquals
                    ? "Assignment export"
                    : "Default export";
                analyzeResult.script.exportStatements.push(exportAssignment);
                InvalidExportStatement(getScriptLocByNode(statement), exportFormat);
                break;
            }

            case ts.SyntaxKind.ExportDeclaration: {
                const exportDeclaration = statement as TS.ExportDeclaration;

                // 含语法错误的声明保留在中间代码中，交由 TypeScript 语言服务器报告语法错误；不收集绑定
                // Declarations with syntax errors are retained in the intermediate code and
                // reported by the TypeScript language server; bindings are not collected
                const hasParseError = hasParseErrorInNode(exportDeclaration, sourceFile);
                if (!hasParseError) {
                    analyzeResult.script.exportStatements.push(exportDeclaration);
                }

                const moduleSpecifier = exportDeclaration.moduleSpecifier;
                const hasValidModuleSpecifier =
                    !!moduleSpecifier && moduleSpecifier.pos !== moduleSpecifier.end;

                if (!exportDeclaration.exportClause) {
                    if (hasValidModuleSpecifier) {
                        InvalidExportStatement(getScriptLocByNode(statement), "Re-export");
                    }
                    break;
                }

                // 不完整的输入: `export * as ns`
                // Incomplete input: `export * as ns`
                if (ts.isNamespaceExport(exportDeclaration.exportClause)) {
                    InvalidExportStatement(
                        getScriptLocByNode(statement),
                        hasValidModuleSpecifier ? "Re-export" : "Namespace export",
                    );
                    break;
                }

                if (hasValidModuleSpecifier) {
                    InvalidExportStatement(getScriptLocByNode(statement), "Re-export");
                    break;
                }

                if (exportDeclaration.isTypeOnly) {
                    InvalidExportStatement(getScriptLocByNode(statement), "Type export");
                    break;
                }

                if (hasParseError) {
                    break;
                }

                for (const element of exportDeclaration.exportClause.elements) {
                    if (element.isTypeOnly) {
                        InvalidExportStatement(getScriptLocByNode(element), "Type export");
                        continue;
                    }

                    const localId = element.propertyName ?? element.name;
                    analyzeResult.script.exportedBindings.push({
                        local: localId.text,
                        exported: element.name.text,
                        localRange: getScriptRangeByNode(localId),
                        exportedRange: getScriptRangeByNode(element.name),
                    });
                }
                break;
            }

            default: {
                if (!ts.canHaveModifiers(statement)) {
                    break;
                }

                if (
                    !statement.modifiers?.some(mod => {
                        return mod.kind === ts.SyntaxKind.ExportKeyword;
                    })
                ) {
                    break;
                }
                analyzeResult.script.exportStatements.push(statement);

                if (
                    statement.modifiers?.some(mod => {
                        return mod.kind === ts.SyntaxKind.DefaultKeyword;
                    })
                ) {
                    InvalidExportStatement(getScriptLocByNode(statement), "Default export");
                    break;
                }

                if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
                    InvalidExportStatement(getScriptLocByNode(statement), "Type export");
                    break;
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
                            exported: statement.name.text,
                            localRange: getScriptRangeByNode(statement.name),
                            exportedRange: getScriptRangeByNode(statement.name),
                        });
                    }
                    break;
                }

                if (ts.isVariableStatement(statement)) {
                    for (const declaration of statement.declarationList.declarations) {
                        walkBindingNameIdentifiers(declaration.name, id => {
                            analyzeResult.script.exportedBindings.push({
                                local: id.text,
                                exported: id.text,
                                localRange: getScriptRangeByNode(id),
                                exportedRange: getScriptRangeByNode(id),
                            });
                        });
                    }
                }
                break;
            }
        }
    }
}
