import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            const options = ["A", "B", "C"]
            let selectedByArray = ["A"]
            let selectedBySet = new Set(["B"])
        </lang-js>

        <section data-page="form-handling-select-multiple-initial-reflection">
            <select id="multi-select-array" multiple &value={selectedByArray}>
                <option !value={item} #for={item of options}>{item}</option>
            </select>

            <select id="multi-select-set" multiple &value={selectedBySet}>
                <option !value={item} #for={item of options}>{item}</option>
            </select>

            <p id="state-array">Array: {selectedByArray.join(",")}</p>
            <p id="state-set">Set: {Array.from(selectedBySet).join(",")}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("regression: multiple select initial selected options do not reflect model", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#state-array")).toHaveText("Array: A")
        await expect(page.locator("#state-set")).toHaveText("Set: B")

        const arrayOptionA = page.locator("#multi-select-array option").nth(0)
        const setOptionB = page.locator("#multi-select-set option").nth(1)

        await expect(arrayOptionA).toHaveJSProperty("selected", true)
        await expect(setOptionB).toHaveJSProperty("selected", true)
    })
})
