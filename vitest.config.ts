import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        include: ["tests/units/**/*.test.ts"],
        setupFiles: "./tests/units/setup.ts"
    }
})
