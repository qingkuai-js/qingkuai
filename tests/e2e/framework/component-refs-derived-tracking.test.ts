import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import DoubledPanel from "./components/ui/DoubledPanel"

            let count = reactive(1)
        </lang-js>

        <section data-page="component-refs-derived-tracking">
            <p id="parent-count">Parent count: {count}</p>
            <DoubledPanel &count={count} />
        </section>
    `,
    components: {
        "ui/DoubledPanel": `
            <lang-js>
                const doubled = derived(() => refs.count * 2)

                const increase = () => {
                    refs.count = refs.count + 1
                }
            </lang-js>

            <article id="doubled-panel">
                <p id="child-count">Child count: {refs.count}</p>
                <p id="child-doubled">Child doubled: {doubled}</p>
                <button id="child-increase" @click={increase}>Increase</button>
            </article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("derived value recomputes when a refs property is written", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#parent-count")).toHaveText("Parent count: 1")
        await expect(page.locator("#child-count")).toHaveText("Child count: 1")
        await expect(page.locator("#child-doubled")).toHaveText("Child doubled: 2")

        await page.locator("#child-increase").click()

        await expect(page.locator("#parent-count")).toHaveText("Parent count: 2")
        await expect(page.locator("#child-count")).toHaveText("Child count: 2")
        await expect(page.locator("#child-doubled")).toHaveText("Child doubled: 4")

        await page.locator("#child-increase").click()

        await expect(page.locator("#parent-count")).toHaveText("Parent count: 3")
        await expect(page.locator("#child-count")).toHaveText("Child count: 3")
        await expect(page.locator("#child-doubled")).toHaveText("Child doubled: 6")
    })
})
