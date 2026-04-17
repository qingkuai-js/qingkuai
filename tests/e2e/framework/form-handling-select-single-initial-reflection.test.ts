import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            const options = ["A", "B", "C"]
            let singleSelected = "B"
        </lang-js>

        <section data-page="form-handling-select-single-initial-reflection">
            <select id="single-select" &value={singleSelected}>
                <option !value={item} #for={item of options}>{item}</option>
            </select>
            <p id="state-single">Single: {singleSelected}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("regression: state is B but single select control initially reflects A", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#state-single")).toHaveText("Single: B")
        await expect(page.locator("#single-select")).toHaveValue("B")
    })
})
