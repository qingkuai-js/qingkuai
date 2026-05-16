import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov", "html"],

            // 单元测试覆盖率仅限于编译器相关代码，运行时行为由 E2E 测试验证。
            // Unit-test coverage is compiler-only; runtime behavior is validated by E2E tests.
            include: ["src/compiler/**"],
            exclude: ["src/compiler/index.ts"]
        },
        setupFiles: "./tests/units/setup.ts",
        include: ["tests/units/**/*.test.ts"]
    }
})
