import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov"],
            include: ["src/compiler/**"],
            exclude: ["src/compiler/index.ts"]
        },
        setupFiles: "./tests/units/setup.ts",
        include: ["tests/units/**/*.test.ts"]
    }
})
