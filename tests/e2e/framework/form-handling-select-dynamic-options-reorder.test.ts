import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let options = ["A", "B", "C"]
            let singleSelected = "B"
            let selectedByArray = ["A"]
            let selectedBySet = new Set(["B"])

            const reorderOptions = () => {
                options = ["C", "A", "B", "D"]
            }
        </lang-js>

        <section data-page="form-handling-select-dynamic-options-reorder">
            <label for="single-select">Single</label>
            <select id="single-select" &value={singleSelected}>
                <option !value={item} #for={item of options} #key={item}>{item}</option>
            </select>

            <label for="multi-select-array">Multiple array</label>
            <select id="multi-select-array" multiple &value={selectedByArray}>
                <option !value={item} #for={item of options} #key={item}>{item}</option>
            </select>

            <label for="multi-select-set">Multiple set</label>
            <select id="multi-select-set" multiple &value={selectedBySet}>
                <option !value={item} #for={item of options} #key={item}>{item}</option>
            </select>

            <button id="reorder-options" @click={reorderOptions}>Reorder options</button>

            <p id="state-single">Single: {singleSelected}</p>
            <p id="state-array">Array: {selectedByArray.join(",")}</p>
            <p id="state-set">Set: {Array.from(selectedBySet).join(",")}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("regression: keeps selected states after dynamic option list reorder", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#single-select").selectOption("A")
        await page.locator("#multi-select-array").selectOption(["B", "C"])
        await page.locator("#multi-select-set").selectOption(["A", "B"])

        await page.locator("#reorder-options").click()

        await expect(page.locator("#state-single")).toHaveText("Single: A")
        await expect(page.locator("#state-array")).toHaveText("Array: B,C")
        await expect(page.locator("#state-set")).toHaveText("Set: A,B")

        await expect(page.locator("#single-select")).toHaveValue("A")
        await expect(page.locator("#multi-select-array option").nth(0)).toHaveJSProperty(
            "selected",
            true
        )
        await expect(page.locator("#multi-select-array option").nth(1)).toHaveJSProperty(
            "selected",
            false
        )
        await expect(page.locator("#multi-select-array option").nth(2)).toHaveJSProperty(
            "selected",
            true
        )

        await expect(page.locator("#multi-select-set option").nth(0)).toHaveJSProperty(
            "selected",
            false
        )
        await expect(page.locator("#multi-select-set option").nth(1)).toHaveJSProperty(
            "selected",
            true
        )
        await expect(page.locator("#multi-select-set option").nth(2)).toHaveJSProperty(
            "selected",
            true
        )
    })
})
