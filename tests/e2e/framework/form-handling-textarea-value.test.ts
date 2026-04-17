import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let note = "hello"
        </lang-js>

        <section data-page="form-handling-textarea-value">
            <textarea id="note-input" &value={note}></textarea>
            <p id="state-note">Note: {note}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("regression: textarea with &value keeps page in loading and throws runtime error", async ({
        page,
        visitScenario
    }) => {
        const errors: string[] = []
        page.on("pageerror", error => {
            errors.push(error.message)
        })

        await visitScenario(scenario)

        await expect(page.locator("body")).toHaveAttribute("data-e2e-ready", "ready")
        await expect(page.locator("#note-input")).toHaveValue("hello")
        await page.locator("#note-input").fill("typed")
        await expect(page.locator("#state-note")).toHaveText("Note: typed")
        expect(errors).toHaveLength(0)
    })
})
