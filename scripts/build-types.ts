import fsExtra from "fs-extra"
import nodeUrl from "node:url"
import nodePath from "node:path"

import { Extractor, ExtractorConfig } from "@microsoft/api-extractor"

const dirPath = nodePath.dirname(nodeUrl.fileURLToPath(import.meta.url))

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
                projectFolder: nodePath.resolve(dirPath, ".."),
                mainEntryPointFilePath: `dist/temp-types/src/${item}.d.ts`
            },
            configObjectFullPath: undefined,
            packageJsonFullPath: nodePath.resolve(dirPath, "../package.json")
        }),
        {
            localBuild: true
        }
    )
})

const languageSrviceDtsTargetPath = nodePath.resolve(
    dirPath,
    "../dist/types/language-service/qingkuai.d.ts"
)
const languageServiceDtsSourceContent = fsExtra.readFileSync(
    nodePath.resolve(dirPath, "../src/types/qingkuai.d.ts"),
    "utf-8"
)
fsExtra.createFileSync(languageSrviceDtsTargetPath)
fsExtra.writeFileSync(
    languageSrviceDtsTargetPath,
    languageServiceDtsSourceContent.replace(
        /(['"])#type-declarations\/runtime(?:-ex)?\1/g,
        "$1../runtime/index$1"
    )
)
