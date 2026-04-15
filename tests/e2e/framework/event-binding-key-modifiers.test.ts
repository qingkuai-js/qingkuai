import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let enterCount = 0
            let escCount = 0
            let shiftEnterCount = 0

            const incEnter = () => {
                enterCount++ 
            }

            const incEsc = () => {
                escCount++ 
            }

            const incShiftEnter = () => {
                shiftEnterCount++ 
            }
        </lang-js>

        <section data-page="event-binding-key-modifiers">
            <input
                id="enter-input"
                placeholder="Press Enter"
                @keydown|enter={incEnter()}
            />
            <p id="enter-count">{enterCount}</p>

            <input
                id="esc-input"
                placeholder="Press Esc"
                @keydown|esc={incEsc()}
            />
            <p id="esc-count">{escCount}</p>

            <input
                id="shift-enter-input"
                placeholder="Press Shift+Enter"
                @keydown|shift|enter={incShiftEnter()}
            />
            <p id="shift-enter-count">{shiftEnterCount}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("enter key modifier fires only on Enter key", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#enter-input").press("Escape")
        await expect(page.locator("#enter-count")).toHaveText("0")

        await page.locator("#enter-input").press("Enter")
        await expect(page.locator("#enter-count")).toHaveText("1")

        await page.locator("#enter-input").press("Tab")
        await expect(page.locator("#enter-count")).toHaveText("1")
    })

    test("esc key modifier fires only on Escape key", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#esc-input").press("Enter")
        await expect(page.locator("#esc-count")).toHaveText("0")

        await page.locator("#esc-input").press("Escape")
        await expect(page.locator("#esc-count")).toHaveText("1")
    })

    test("combined shift+enter modifier fires only with shift held", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#shift-enter-input").press("Enter")
        await expect(page.locator("#shift-enter-count")).toHaveText("0")

        await page.locator("#shift-enter-input").press("Shift+Enter")
        await expect(page.locator("#shift-enter-count")).toHaveText("1")
    })
})
