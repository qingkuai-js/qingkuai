import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import SyncPanel from "./components/SyncPanel"

            const AsyncModule = import("./components/AsyncOne")

            const AsyncFunc = import("./components/AsyncTwo").then(module => module.default)
        </lang-js>

        <section data-page="async-components-direct-render">
            <h1 id="async-direct-title">Async Components Direct Render</h1>
            <SyncPanel />
            <AsyncModule />
            <AsyncFunc />
        </section>
    `,
    components: {
        SyncPanel: `
            <article id="sync-panel">Sync Panel</article>
        `,
        AsyncOne: `
            <article id="async-one">Async One Direct</article>
        `,
        AsyncTwo: `
            <article id="async-two">Async Two Direct</article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("renders async components written directly without #await", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page).toHaveTitle("async-components-direct-render")
        await expect(page.locator("#async-one")).toHaveText("Async One Direct")
        await expect(page.locator("#async-two")).toHaveText("Async Two Direct")
    })

    test("renders async components alongside a synchronous component", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#sync-panel")).toHaveText("Sync Panel")
        await expect(page.locator("#async-one")).toHaveText("Async One Direct")
        await expect(page.locator("#async-two")).toHaveText("Async Two Direct")
    })
})
