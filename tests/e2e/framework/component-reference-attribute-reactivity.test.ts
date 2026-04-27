import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import CounterPanel from "./components/ui/CounterPanel"

            let score = 1
        </lang-js>

        <section data-page="component-reference-attribute-reactivity">
            <p id="parent-score">Parent score: {score}</p>
            <CounterPanel &score={score} />
        </section>
    `,
    components: {
        "ui/CounterPanel": `
            <lang-js>
                const increase = () => {
                    refs.score++
                }
            </lang-js>

            <article id="counter-panel">
                <p id="child-score">Child score: {refs.score}</p>
                <button id="child-increase" @click={increase}>Increase</button>
            </article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("syncs component reference attribute writes back to parent let target", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#parent-score")).toHaveText("Parent score: 1")
        await expect(page.locator("#child-score")).toHaveText("Child score: 1")

        await page.locator("#child-increase").click()

        await expect(page.locator("#parent-score")).toHaveText("Parent score: 2")
        await expect(page.locator("#child-score")).toHaveText("Child score: 2")
    })
})
