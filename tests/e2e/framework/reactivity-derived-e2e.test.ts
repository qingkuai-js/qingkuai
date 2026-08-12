import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let base = reactive(1)

            const doubled = derived(() => base * 2)
            const computed = derivedExp(base + 10)

            const incBase = () => {
                base++
            }
        </lang-js>

        <section data-page="reactivity-derived-e2e">
            <h1 id="title">Derived Reactivity</h1>
            <p id="double">Double: {doubled}</p>
            <p id="computed">Computed: {computed}</p>
            <button id="btn-inc" @click={incBase}>Inc base</button>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("derived values update when dependencies change", async ({ page, visitScenario }) => {
        await visitScenario(scenario)
        await expect(page.locator("#double")).toHaveText("Double: 2")
        await expect(page.locator("#computed")).toHaveText("Computed: 11")

        await page.locator("#btn-inc").click()
        await expect(page.locator("#double")).toHaveText("Double: 4")
        await expect(page.locator("#computed")).toHaveText("Computed: 12")
    })
})
