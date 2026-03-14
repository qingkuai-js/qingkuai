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
