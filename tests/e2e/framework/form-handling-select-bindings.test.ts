import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            const options = ["A", "B", "C"]
            let singleSelected = "B"
            let selectedByArray = ["A"]
            let selectedBySet = new Set(["B"])

            const applyModelPreset = () => {
                singleSelected = "C"
                selectedByArray = ["B", "C"]
                selectedBySet = new Set(["A", "C"])
            }
        </lang-js>

        <section data-page="form-handling-select-bindings">
            <label for="single-select">Single</label>
            <select id="single-select" &value={singleSelected}>
                <option !value={item} #for={item of options}>{item}</option>
            </select>

            <label for="multi-select-array">Multiple array</label>
            <select id="multi-select-array" multiple &value={selectedByArray}>
                <option !value={item} #for={item of options}>{item}</option>
            </select>

            <label for="multi-select-set">Multiple set</label>
            <select id="multi-select-set" multiple &value={selectedBySet}>
                <option !value={item} #for={item of options}>{item}</option>
            </select>

            <button id="apply-select-preset" @click={applyModelPreset}>Apply select preset</button>

            <p id="state-single">Single: {singleSelected}</p>
            <p id="state-array">Array: {selectedByArray.join(",")}</p>
            <p id="state-set">Set: {Array.from(selectedBySet).join(",")}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("renders initial select states from model values", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#state-single")).toHaveText("Single: B")
        await expect(page.locator("#state-array")).toHaveText("Array: A")
        await expect(page.locator("#state-set")).toHaveText("Set: B")
    })

    test("syncs select control interactions back to model states", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#single-select").selectOption("A")
        await page.locator("#multi-select-array").selectOption(["B", "C"])
        await page.locator("#multi-select-set").selectOption(["A"])

        await expect(page.locator("#state-single")).toHaveText("Single: A")
        await expect(page.locator("#state-array")).toHaveText("Array: B,C")
        await expect(page.locator("#state-set")).toHaveText("Set: A")
    })

    test("clears array and set models when multiple select options are fully deselected", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#multi-select-array").selectOption([])
        await page.locator("#multi-select-set").selectOption([])

        await expect(page.locator("#state-array")).toHaveText("Array: ")
        await expect(page.locator("#state-set")).toHaveText("Set: ")
    })

    test("applies model updates back to select controls", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#apply-select-preset").click()

        await expect(page.locator("#state-single")).toHaveText("Single: C")

        const arrayOptionA = page.locator("#multi-select-array option").nth(0)
        const arrayOptionB = page.locator("#multi-select-array option").nth(1)
        const arrayOptionC = page.locator("#multi-select-array option").nth(2)
        await expect(arrayOptionA).toHaveJSProperty("selected", false)
        await expect(arrayOptionB).toHaveJSProperty("selected", true)
        await expect(arrayOptionC).toHaveJSProperty("selected", true)

        const setOptionA = page.locator("#multi-select-set option").nth(0)
        const setOptionB = page.locator("#multi-select-set option").nth(1)
        const setOptionC = page.locator("#multi-select-set option").nth(2)
        await expect(setOptionA).toHaveJSProperty("selected", true)
        await expect(setOptionB).toHaveJSProperty("selected", false)
        await expect(setOptionC).toHaveJSProperty("selected", true)
    })
})
