import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            const flagState = {
                radioChecked: false,
                checkboxChecked: false
            }

            let selectedByArray = ["A"]
            let selectedBySet = new Set(["left"])

            const resetSelections = () => {
                flagState.radioChecked = false
                flagState.checkboxChecked = false
                selectedByArray = ["A"]
                selectedBySet = new Set(["left"])
            }
        </lang-js>

        <section data-page="form-handling-choice-bindings">
            <label>
                <input id="single-radio" type="radio" &checked={flagState.radioChecked} />
                Single radio
            </label>

            <label>
                <input id="single-checkbox" type="checkbox" &checked={flagState.checkboxChecked} />
                Single checkbox
            </label>

            <fieldset>
                <legend>Array Group</legend>
                <label>
                    <input id="arr-a" type="checkbox" value="A" &group={selectedByArray} />A
                </label>
                <label>
                    <input id="arr-b" type="checkbox" value="B" &group={selectedByArray} />B
                </label>
            </fieldset>

            <fieldset>
                <legend>Set Group</legend>
                <label>
                    <input id="set-left" type="radio" name="pos" value="left" &group={selectedBySet} />Left
                </label>
                <label>
                    <input id="set-right" type="radio" name="pos" value="right" &group={selectedBySet} />Right
                </label>
            </fieldset>

            <button id="reset-selections" @click={resetSelections}>Reset</button>

            <p id="state-radio">Radio: {flagState.radioChecked ? "yes" : "no"}</p>
            <p id="state-checkbox">Checkbox: {flagState.checkboxChecked ? "yes" : "no"}</p>
            <p id="state-array">Array: {selectedByArray.join(",")}</p>
            <p id="state-set">Set: {Array.from(selectedBySet).join(",")}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("syncs single radio and checkbox checked states", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#single-radio").check()
        await page.locator("#single-checkbox").check()

        await expect(page.locator("#state-radio")).toHaveText("Radio: yes")
        await expect(page.locator("#state-checkbox")).toHaveText("Checkbox: yes")
    })

    test("syncs group states for array and set targets", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#state-array")).toHaveText("Array: A")
        await expect(page.locator("#state-set")).toHaveText("Set: left")

        await page.locator("#arr-b").check()
        await page.locator("#arr-a").uncheck()
        await page.locator("#set-right").check()

        await expect(page.locator("#state-array")).toHaveText("Array: B")
        await expect(page.locator("#state-set")).toHaveText("Set: left,right")
    })

    test("writes reset model values back to controls", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#single-radio").check()
        await page.locator("#single-checkbox").check()
        await page.locator("#arr-b").check()
        await page.locator("#set-right").check()

        await page.locator("#reset-selections").click()

        await expect(page.locator("#single-radio")).not.toBeChecked()
        await expect(page.locator("#single-checkbox")).not.toBeChecked()
        await expect(page.locator("#arr-a")).toBeChecked()
        await expect(page.locator("#arr-b")).not.toBeChecked()
        await expect(page.locator("#state-set")).toHaveText("Set: left")
    })
})
