import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            const form = {
                values: {
                    text: "alpha",
                    checked: [false, true]
                }
            }

            let toggles = ["x"]
            const currentIndex = 1

            const applyExpressionPreset = () => {
                form.values.text = "preset"
                form.values.checked[currentIndex] = false
                toggles = ["y"]
            }
        </lang-js>

        <section data-page="form-handling-expression-targets">
            <input id="expr-text" &value={form.values.text} />
            <input id="expr-checked" type="checkbox" &checked={form.values.checked[currentIndex]} />

            <label>
                <input id="expr-group-x" type="checkbox" value="x" &group={toggles} />X
            </label>
            <label>
                <input id="expr-group-y" type="checkbox" value="y" &group={toggles} />Y
            </label>

            <button id="expr-apply-preset" @click={applyExpressionPreset}>Apply preset</button>

            <p id="expr-state-text">Text: {form.values.text}</p>
            <p id="expr-state-checked">Checked@1: {form.values.checked[1] ? "yes" : "no"}</p>
            <p id="expr-state-group">Group: {toggles.join(",")}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports member expression targets for form reference attributes", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#expr-state-text")).toHaveText("Text: alpha")
        await expect(page.locator("#expr-state-checked")).toHaveText("Checked@1: yes")
        await expect(page.locator("#expr-state-group")).toHaveText("Group: x")

        await page.locator("#expr-text").fill("typed")
        await page.locator("#expr-checked").uncheck()
        await page.locator("#expr-group-y").check()
        await page.locator("#expr-group-x").uncheck()

        await expect(page.locator("#expr-state-text")).toHaveText("Text: typed")
        await expect(page.locator("#expr-state-checked")).toHaveText("Checked@1: no")
        await expect(page.locator("#expr-state-group")).toHaveText("Group: y")
    })

    test("writes model expression updates back to controls", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#expr-apply-preset").click()

        await expect(page.locator("#expr-text")).toHaveValue("preset")
        await expect(page.locator("#expr-checked")).not.toBeChecked()
        await expect(page.locator("#expr-group-x")).not.toBeChecked()
        await expect(page.locator("#expr-group-y")).toBeChecked()
    })
})
