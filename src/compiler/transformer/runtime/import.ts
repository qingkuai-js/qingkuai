import ts from "typescript"

import { analyzeResult, inputDescriptor } from "../../state"

// 基于 AST 将脚本中的 .qk 导入路径替换为 .js，兼容 query 参数（如 ?raw）
// Replace .qk import paths in the script with .js based on AST,
// compatible with query parameters (e.g. ?raw).
export function replaceQkImportSpecifiers() {
    if (!inputDescriptor.options.replaceQkImports || !inputDescriptor.script.code) {
        return
    }

    for (const decl of analyzeResult.script.importDeclarations) {
        let specifierText: string | undefined
        let specifierStart = 0

        if (ts.isImportDeclaration(decl) && ts.isStringLiteral(decl.moduleSpecifier)) {
            specifierText = decl.moduleSpecifier.text
            specifierStart = decl.moduleSpecifier.getStart() + 1
        } else if (ts.isImportEqualsDeclaration(decl)) {
            const ref = decl.moduleReference
            if (ts.isExternalModuleReference(ref) && ts.isStringLiteral(ref.expression)) {
                specifierText = ref.expression.text
                specifierStart = ref.expression.getStart() + 1
            }
        }

        if (!specifierText) {
            continue
        }

        // 在 query 参数之前查找 .qk 扩展名
        // Find .qk extension before any query parameters.
        const pathWithoutQuery = specifierText.replace(/\?.*$/, "")
        const qkIndex = pathWithoutQuery.lastIndexOf(".qk")
        if (qkIndex === -1) {
            continue
        }

        const absStart = specifierStart + qkIndex
        const code = inputDescriptor.script.code
        const absEnd = absStart + 3

        inputDescriptor.script.code = code.slice(0, absStart) + ".js" + code.slice(absEnd)
    }
}
