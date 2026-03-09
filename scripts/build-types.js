import fs from "node:fs"
import url from "node:url"
import path from "node:path"
import childProcess from "node:child_process"

const dir = path.dirname(url.fileURLToPath(import.meta.url))

;["runtime/index", "runtime/internal", "compiler/index"].forEach(item => {
    const envDtsFilePath = path.resolve(dir, "../env.d.ts")
    const filePath = path.resolve(dir, "../src", item + ".ts")
    const fileContent = fs.readFileSync(filePath, "utf-8")
    fs.writeFileSync(
        filePath,
        `/// <reference types="${envDtsFilePath}" />\n${fileContent}`,
        "utf-8"
    )

    try {
        childProcess.execSync(
            `npx dts-bundle-generator --project tsconfig.json -o dist/types/${item}.d.ts --export-referenced-types false src/${item}.ts`,
            { stdio: "inherit" }
        )
    } finally {
        fs.writeFileSync(filePath, fileContent, "utf-8")
    }
})
