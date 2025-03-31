import * as rollup from "rollup"
import dts from "rollup-plugin-dts"
import esbuild from "rollup-plugin-esbuild"

export default rollup.defineConfig(commentLineArgs => {
    const result = []
    const isWatchMode = commentLineArgs.watch
    const folders = ["runtime/index", "compiler/index", "runtime/internal"]
    const external = ["@babel/parser", "@jridgewell/sourcemap-codec", "node:crypto"]

    folders.forEach(folder => {
        const esmItem = {
            input: `./src/${folder}.ts`,
            external,
            plugins: [
                esbuild({
                    target: "esNext"
                })
            ],
            output: {
                format: "es",
                inlineDynamicImports: true,
                file: `dist/esm/${folder}.js`
            }
        }
        result.push(esmItem, {
            ...esmItem,
            output: {
                ...esmItem.output,
                format: "cjs",
                file: `dist/cjs/${folder}.cjs`
            }
        })
    })

    if (!isWatchMode) {
        folders.forEach(folder => {
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
