import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import Wrapper from "./components/Wrapper"
        </lang-js>

        <section data-page="component-nested-bare">
            <h1 id="page-title">Bare Nested Component</h1>
            <Wrapper />
        </section>
    `,
    components: {
        Wrapper: `
            <lang-js>
                import Badge from "./Badge"
            </lang-js>

            <div id="wrapper">
                <Badge />
            </div>
        `,
        Badge: `
            <span id="badge">BADGE</span>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("renders child component nested without props", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#page-title")).toHaveText("Bare Nested Component")
        await expect(page.locator("#wrapper")).toBeVisible()
        await expect(page.locator("#badge")).toHaveText("BADGE")
    })
})
