import fsExtra from "fs-extra"
import nodeUrl from "node:url"
import nodePath from "node:path"

import ts from "typescript"
import { readSync } from "../src/util/scripts/sundry"
import { whitespaceRE } from "../src/compiler/regular"
import { formatSourceCode } from "../src/util/shared/sundry"
import { CodeEditor } from "../src/compiler/transformer/editor"
import { Extractor, ExtractorConfig } from "@microsoft/api-extractor"

function main() {
    const PWD = nodePath.dirname(nodeUrl.fileURLToPath(import.meta.url))
    const PROJECT_DIR = nodePath.resolve(PWD, "..")
    const TARGET_PATH = nodePath.resolve(PROJECT_DIR, "dist/types")
    const BRAND_SOURCE_PATH = nodePath.resolve(PROJECT_DIR, "src/types/brand.d.ts")
    const BRAND_TARGET_PATH = nodePath.resolve(TARGET_PATH, "language-service/brand.d.ts")

    // 构建类型声明
    // Build the type declarations
    ;["runtime/index", "runtime/internal", "compiler/index"].forEach(item => {
        Extractor.invoke(
            ExtractorConfig.prepare({
                configObject: {
                    dtsRollup: {
                        enabled: true,
                        publicTrimmedFilePath: `dist/types/${item}.d.ts`
                    },
                    compiler: {
                        tsconfigFilePath: "tsconfig.json"
                    },
                    projectFolder: nodePath.resolve(PROJECT_DIR),
                    mainEntryPointFilePath: `dist/temp-types/src/${item}.d.ts`
                },
                configObjectFullPath: undefined,
                packageJsonFullPath: nodePath.resolve(PROJECT_DIR, "package.json")
            }),
            {
                localBuild: true
            }
        )
    })

    // 语言服务类型：原样拷贝，重写别名导入
    // Language-service types: raw copy with alias imports rewritten
    const languageSrviceDtsTargetPath = nodePath.resolve(
        TARGET_PATH,
        "language-service/qingkuai.d.ts"
    )
    const languageServiceDtsSourceContent = readSync(
        nodePath.resolve(PROJECT_DIR, "src/types/qingkuai.d.ts")
    )
    fsExtra.createFileSync(languageSrviceDtsTargetPath)
    fsExtra.writeFileSync(
        languageSrviceDtsTargetPath,
        languageServiceDtsSourceContent.replace(
            /(['"])#type-declarations\/(runtime(?:-ex)?)\1/g,
            "$1../runtime/index$1"
        )
    )

    // 将品牌类型声明文件移动到构建结果目录
    // Move the brand type declaration file to the build result directory
    fsExtra.copySync(BRAND_SOURCE_PATH, BRAND_TARGET_PATH)

    // 断言构建结果中中无内联品牌声明，并改写品牌类型导入路径
    // Assert that the build results contain no inlined brand
    // declarations, and rewrite the brand type import paths
    const fullDistDtsFiles = fsExtra.readdirSync(TARGET_PATH, {
        recursive: true
    })
    for (const file of fullDistDtsFiles) {
        const filePath = nodePath.resolve(TARGET_PATH, file.toString())
        if (!filePath.endsWith(".d.ts") || filePath.endsWith("brand.d.ts")) {
            continue
        }

        const relativeBrandPath = nodePath.relative(nodePath.dirname(filePath), BRAND_TARGET_PATH)
        fsExtra.writeFileSync(
            filePath,
            readSync(filePath).replaceAll(
                "@qingkuai/virtual/brand",
                relativeBrandPath.startsWith(".") ? relativeBrandPath : `./${relativeBrandPath}`
            )
        )
        assertNoInlinedBrand(filePath)

        // 将接口调用签名上的 JSDoc 复制注入到该产物中引用它们的 const 声明上方
        // Copy the JSDoc from the call signatures of the interfaces and inject it
        // above the const declarations referencing them in the generated d.ts files
        injectCallSignatureDocs(filePath)
    }
}

function injectCallSignatureDocs(targetDtsPath: string) {
    const content = readSync(targetDtsPath)
    const editor = new CodeEditor(content, 0)
    const interfaceToGetDeclaration = new Map<string, (name: string) => string>()
    const sourceFile = ts.createSourceFile(targetDtsPath, content, ts.ScriptTarget.Latest, true)
    for (const statement of sourceFile.statements) {
        if (!ts.isInterfaceDeclaration(statement)) {
            continue
        }
        for (const member of statement.members) {
            if (!ts.isCallSignatureDeclaration(member)) {
                continue
            }

            const doc = ts.getJSDocCommentsAndTags(member).filter(ts.isJSDoc)
            if (!doc.length) {
                continue
            }

            const indent = " ".repeat(4)
            const signature = formatSourceCode(indent + member.getText())
            const docContent = formatSourceCode(indent + doc[0].getText())
            interfaceToGetDeclaration.set(statement.name.text, (name: string) => {
                return `${docContent}\nexport declare function ${name}${signature}`
            })
            editor.remove(statement.getFullStart(), statement.getEnd())
            break
        }
    }

    for (const statement of sourceFile.statements) {
        if (!ts.isVariableStatement(statement)) {
            continue
        }
        for (const declaration of statement.declarationList.declarations) {
            if (
                !declaration.type ||
                !ts.isIdentifier(declaration.name) ||
                !ts.isTypeReferenceNode(declaration.type)
            ) {
                continue
            }

            const getDeclaration = interfaceToGetDeclaration.get(
                declaration.type.typeName.getText(sourceFile)
            )
            if (!getDeclaration) {
                continue
            }

            // 计算前导空白中的换行数，以确保生成内容与前一声明之间保留适当的空行
            // Count leading newlines to ensure proper blank lines between declarations
            let prevNewLineCount = 0
            const insertPos = statement.getStart()
            for (let i = insertPos - 1; i >= 0 && prevNewLineCount < 2; i--) {
                if (!whitespaceRE.test(content[i])) {
                    break
                }
                if (content[i] === "\n") {
                    prevNewLineCount++
                }
            }

            const name = declaration.name.getText(sourceFile)
            const leading = prevNewLineCount === 2 ? "" : "\n"
            const comment = `// Generated by build-types script\n`
            editor.replace(
                statement.getStart(),
                statement.getEnd(),
                leading + comment + getDeclaration(name)
            )
        }
    }
    fsExtra.writeFileSync(targetDtsPath, editor.result)
}

function assertNoInlinedBrand(filePath: string) {
    if (/declare (?:type|const) (?:QingkuaiComponent|RENDER)\b/.test(readSync(filePath))) {
        throw new Error(
            `[build-types] ${filePath} contains inlined brand declarations — ` +
                "the brand must keep a single source in ./brand to preserve symbol identity"
        )
    }
}

main()
