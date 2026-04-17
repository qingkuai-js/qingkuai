import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            const options = ["A", "B", "C"]
            const selectedByArray = ["A"]
            const selectedBySet = new Set(["B"])
        </lang-js>

        <section data-page="form-handling-select-const-multiple-sync">
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
    test("syncs multiple select interactions back to const array and set targets", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#state-array")).toHaveText("Array: A")
        await expect(page.locator("#state-set")).toHaveText("Set: B")

        await page.locator("#multi-select-array").selectOption(["B", "C"])
        await page.locator("#multi-select-set").selectOption(["A"])

        await expect(page.locator("#state-array")).toHaveText("Array: B,C")
        await expect(page.locator("#state-set")).toHaveText("Set: A")
    })
})
