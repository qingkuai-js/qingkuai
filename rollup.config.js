import * as rollup from "rollup"
import dts from "rollup-plugin-dts"
import esbuild from "rollup-plugin-esbuild"

export default rollup.defineConfig(commentLineArgs => {
    const isWatchMode = commentLineArgs.watch

    const ret = [
        {
            external: ["@babel/parser", "@jridgewell/sourcemap-codec"],
            input: {
                "runtime/index": "./src/runtime/index.ts",
                "compiler/index": "./src/compiler/index.ts",
                "runtime/internal": "./src/runtime/internal.ts"
            },
            output: {
                dir: "dist",
                format: "es",
                chunkFileNames: "chunks/[name].js"
            },
            plugins: [
                esbuild({
                    target: "esNext"
                })
            ]
        }
    ]

    if (!isWatchMode) {
        ret.push({
            input: {
                "runtime/index": "./dist/types/runtime/index.d.ts",
                "compiler/index": "./dist/types/compiler/index.d.ts",
                "runtime/internal": "./dist/types/runtime/internal.d.ts"
            },
            output: {
                dir: "dist",
                format: "es",
                chunkFileNames: "chunks/type.d.ts"
            },
            plugins: [dts()]
        })
    }

    return ret
})
