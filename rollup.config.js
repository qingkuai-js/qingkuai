import * as rollup from "rollup"
import dts from "rollup-plugin-dts"
import esbuild from "rollup-plugin-esbuild"

export default rollup.defineConfig(commentLineArgs => {
    const result = []
    const isWatchMode = commentLineArgs.watch

    const inputOptions = {
        external: ["@babel/parser", "@jridgewell/sourcemap-codec", "node:crypto", "entities"],
        input: {
            "runtime/index": "./src/runtime/index.ts",
            "compiler/index": "./src/compiler/index.ts",
            "runtime/internal": "./src/runtime/internal.ts"
        },
        output: {
            dir: "dist/esm",
            format: "es",
            chunkFileNames: "chunks/[name].js"
        },
        plugins: [esbuild()]
    }

    result.push(
        inputOptions,
        Object.assign({}, inputOptions, {
            output: {
                dir: "dist/cjs",
                format: "cjs",
                entryFileNames: "[name].cjs",
                chunkFileNames: "chunks/[name].cjs"
            }
        })
    )

    if (!isWatchMode) {
        ;["runtime/index", "compiler/index", "runtime/internal"].forEach(folder => {
            result.push({
                input: `./dist/temp-types/${folder}.d.ts`,
                output: {
                    format: "es",
                    inlineDynamicImports: true,
                    file: `dist/types/${folder}.d.ts`
                },
                plugins: [dts()]
            })
        })
    }

    return result
})
