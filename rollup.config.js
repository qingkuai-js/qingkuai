import * as rollup from "rollup"
import esbuild from "rollup-plugin-esbuild"

export default rollup.defineConfig(commentLineArgs => {
    return {
        input: {
            "runtime/index": "./src/runtime/index.ts",
            "runtime/internal": "./src/runtime/internal.ts"
        },
        output: {
            dir: "dist",
            format: "es",
            chunkFileNames(info) {
                for (const id of info.moduleIds) {
                    if (id.includes("/src/runtime")) {
                        return "chunks/runtime.js"
                    }
                }
                return "chunks/utils.js"
            }
        },
        plugins: [esbuild()],
        onwarn(warning) {
            if (warning.code === "CIRCULAR_DEPENDENCY") {
                return
            }
        }
    }
})
