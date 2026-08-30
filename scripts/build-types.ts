import fsExtra from "fs-extra"
import nodeUrl from "node:url"
import nodePath from "node:path"

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
    const languageServiceDtsSourceContent = fsExtra.readFileSync(
        nodePath.resolve(PROJECT_DIR, "src/types/qingkuai.d.ts"),
        "utf-8"
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

        const content = fsExtra.readFileSync(filePath, "utf-8")
        const relativeBrandPath = nodePath.relative(nodePath.dirname(filePath), BRAND_TARGET_PATH)
        fsExtra.writeFileSync(
            filePath,
            content.replaceAll(
                "@qingkuai/virtual/brand",
                relativeBrandPath.startsWith(".") ? relativeBrandPath : `./${relativeBrandPath}`
            )
        )
        assertNoInlinedBrand(filePath)
    }
}

function assertNoInlinedBrand(filePath: string) {
    const content = fsExtra.readFileSync(filePath, "utf-8")
    if (/declare (?:type|const) (?:QingkuaiComponent|RENDER)\b/.test(content)) {
        throw new Error(
            `[build-types] ${filePath} contains inlined brand declarations — ` +
                "the brand must keep a single source in ./brand to preserve symbol identity"
        )
    }
}

main()
