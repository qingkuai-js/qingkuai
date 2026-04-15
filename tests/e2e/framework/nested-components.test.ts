import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import Panel from "./components/layout/Panel"
        </lang-js>

        <section data-page="nested-components">
            <h1 id="nested-title">Nested Components</h1>
            <Panel />
        </section>
    `,
    components: {
        "layout/Panel": `
            <lang-js>
                import Leaf from "./Leaf"
            </lang-js>

            <div id="nested-panel">
                <Leaf />
            </div>
        `,
        "layout/Leaf": `
            <p id="nested-leaf">Nested Leaf</p>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test.describe("nested components case", () => {
        test("renders nested components page", async ({ page, visitScenario }) => {
            await visitScenario(scenario)

            await expect(page).toHaveTitle("nested-components")
            await expect(page.locator("#nested-title")).toHaveText("Nested Components")
            await expect(page.locator("#nested-panel")).toBeVisible()
            await expect(page.locator("#nested-leaf")).toHaveText("Nested Leaf")
            await expect(page.locator("#nested-panel")).toHaveCount(1)
            await expect(page.locator("#nested-leaf")).toHaveCount(1)
            await expect(page.locator("[data-page='nested-components']")).toContainText(
                "Nested Leaf"
            )
        })
    })
})
