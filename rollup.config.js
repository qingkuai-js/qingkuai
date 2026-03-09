import { defineConfig } from "rollup"

import esbuild from "rollup-plugin-esbuild"

export default defineConfig(commentLineArgs => {
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
        plugins: [esbuild()],
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
