import { defineConfig } from "eslint/config"

import js from "@eslint/js"
import nodeUrl from "node:url"
import nodePath from "node:path"
import tsEslint from "typescript-eslint"

export default defineConfig([
    {
        ignores: ["dist", "node_modules", "tests", "test-space"]
    },
    js.configs.recommended,
    ...tsEslint.configs.recommended,

    // override
    {
        plugins: {
            project: {
                rules: getProjectRules({
                    chaoticImportPairs: [
                        {
                            source: "src/compiler",
                            forbiddens: ["src/runtime"]
                        },
                        {
                            source: "src/runtime",
                            forbiddens: ["src/compiler"]
                        }
                    ]
                })
            }
        },
        rules: {
            "no-useless-assignment": "off",
            "project/no-chaotic-imports": "error",
            "@typescript-eslint/no-explicit-any": "off"
        }
    },
    {
        rules: {
            "no-useless-escape": "off"
        },
        files: ["**/regular.ts"]
    }
])

function getProjectRules(options) {
    const DIRNAME = nodePath.dirname(nodeUrl.fileURLToPath(import.meta.url))
    const chaoticImportInfos = options.chaoticImportPairs.map(pair => {
        pair.forbiddens = pair.forbiddens.map(forbiddenPath => {
            return nodePath.resolve(DIRNAME, forbiddenPath)
        })
        return {
            source: pair.source,
            forbiddenPaths: pair.forbiddens,
            sourcePath: nodePath.resolve(DIRNAME, pair.source)
        }
    })
    return {
        "no-chaotic-imports": {
            meta: {
                docs: {
                    recommended: "error",
                    description: "Chaotic imports is not allowed in this project."
                },
                type: "problem"
            },
            create(context) {
                let chaoticPair = undefined
                for (const item of chaoticImportInfos) {
                    if (context.filename.startsWith(item.sourcePath)) {
                        chaoticPair = item
                        break
                    }
                }
                if (!chaoticPair) {
                    return {}
                }
                return {
                    ImportDeclaration(node) {
                        const importSource = node.source.value
                        const importPath = nodePath.resolve(
                            nodePath.dirname(context.filename),
                            importSource
                        )
                        if (
                            typeof importPath === "string" &&
                            chaoticPair.forbiddenPaths.some(forbiddenPath =>
                                importPath.startsWith(forbiddenPath)
                            )
                        ) {
                            context.report({
                                node,
                                message: `Import from '${importSource}' is disallowed in files under '${chaoticPair.source}'.`
                            })
                        }
                    }
                }
            }
        }
    }
}
