import nodeFs from "node:fs"
import esbuild from "rollup-plugin-esbuild"

import { defineConfig } from "rollup"

export default defineConfig(() => {
    const result = []

    const baseOptions = {
        input: {
            "runtime/index": "./src/runtime/index.ts",
            "compiler/index": "./src/compiler/index.ts",
            "runtime/internal": "./src/runtime/internal.ts"
        },
        onwarn(warning) {
            if (warning.code === "CIRCULAR_DEPENDENCY") {
                return
            }
        },
        plugins: [replacePacakgeVersionPlugin(), esbuild()],
        external: ["@babel/parser", "@jridgewell/sourcemap-codec"]
    }

    result.push(
        {
            ...baseOptions,
            output: getOutput("es", "dist/esm")
        },
        {
            ...baseOptions,
            output: getOutput("cjs", "dist/cjs")
        }
    )
    return result
})

function getOutput(format, dir) {
    const ext = format === "cjs" ? ".cjs" : ".js"
    return {
        dir,
        format,
        entryFileNames: `[name]${ext}`,
        chunkFileNames(info) {
            // moduleIds 在 Windows 上是反斜杠路径，统一转成正斜杠再匹配
            // moduleIds use backslashes on Windows, normalize them before matching
            for (const rawId of info.moduleIds) {
                const id = rawId.replaceAll("\\", "/")
                if (id.includes("/src/runtime/constants")) {
                    return `chunks/shared${ext}`
                }
                if (id.includes("/src/runtime")) {
                    return `runtime/chunk${ext}`
                }
            }
        }
    }
}

function replacePacakgeVersionPlugin() {
    const VERSION_SOURCE_ID = "/src/runtime/meta.ts"
    const VERSION_PLACEHOLDER = "__QK_PACKAGE_VERSION__"
    const PACKAGE_INFO = JSON.parse(nodeFs.readFileSync("./package.json", "utf8"))
    return {
        name: "replace-package-version",
        renderChunk(code, chunk) {
            if (
                !chunk.moduleIds.some(id => {
                    return id.replaceAll("\\", "/").includes(VERSION_SOURCE_ID)
                })
            ) {
                return null
            }
            return code.replaceAll(VERSION_PLACEHOLDER, PACKAGE_INFO.version)
        }
    }
}
