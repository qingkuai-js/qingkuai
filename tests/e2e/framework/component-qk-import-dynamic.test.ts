import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let CurrentView = import("./components/Panel.qk")

            const switchToSecond = () => {
                CurrentView = import("./components/Panel2.qk")
            }
        </lang-js>

        <section data-page="component-qk-import-dynamic">
            <h1 id="title">QK Dynamic Import</h1>
            <button id="btn-switch" @click={switchToSecond}>Switch</button>
            <CurrentView />
        </section>
    `,
    components: {
        Panel: `<article id="panel-one">Panel One</article>`,
        Panel2: `<article id="panel-two">Panel Two</article>`
    },
    compileOptions: {
        replaceQkImports: true
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("dynamically imported .qk components render and switch", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await expect(page.locator("#panel-one")).toHaveText("Panel One")

        await page.locator("#btn-switch").click()
        await expect(page.locator("#panel-two")).toHaveText("Panel Two")
        await expect(page.locator("#panel-one")).toHaveCount(0)
    })
})
