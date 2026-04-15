import type {
    E2EScenario,
    E2ETestRegistrar,
    E2EScenarioInput,
    E2EScenarioTestModule
} from "#type-declarations/testing"

export async function defineE2ETestFile(
    moduleUrl: string,
    scenario: E2EScenarioInput,
    registerTests: E2ETestRegistrar
) {
    const fileName = new URL(moduleUrl.split("?")[0]).pathname.split("/").pop()!
    ;(scenario as E2EScenario).name = fileName.replace(/\.test\.ts$/, "")

    if (!new URL(moduleUrl).searchParams.has("registry")) {
        const [{ test }, { expect }] = await Promise.all([
            import("./fixture"),
            import("@playwright/test")
        ])
        registerTests({ test, expect })
    }

    return { scenario: scenario as E2EScenario } satisfies E2EScenarioTestModule
}
