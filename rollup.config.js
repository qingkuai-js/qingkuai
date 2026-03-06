import { defineConfig } from "rollup"

import dts from "rollup-plugin-dts"
import esbuild from "rollup-plugin-esbuild"

export default defineConfig(commentLineArgs => {
    const result = []
    const isWatchMode = commentLineArgs.watch

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
        plugins: [esbuild()]
    }

    if (!isWatchMode) {
        ;["runtime/index", "compiler/index", "runtime/internal"].forEach(folder => {
            result.push({
                output: {
                    format: "es",
                    inlineDynamicImports: true,
                    file: `dist/types/${folder}.d.ts`
                },
                plugins: [
                    dts({
                        tsconfig: "./tsconfig.json"
                    })
                ],
                input: `./dist/temp-types/src/${folder}.d.ts`
            })
        })
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
    return {
        dir,
        format,
        chunkFileNames(info) {
            for (const id of info.moduleIds) {
                if (id.includes("/src/runtime/constants")) {
                    return "chunks/shared.js"
                }
                if (id.includes("/src/runtime")) {
                    return "runtime/chunk.js"
                }
            }
        }
    }
}
