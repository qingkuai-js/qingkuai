import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let accepted = false
        </lang-js>

        <section data-page="form-handling-checked-inferred-reactivity">
            <label>
                <input id="accept-checkbox" type="checkbox" &checked={accepted} />
                Accept
            </label>
            <p id="state-accepted">Accepted: {accepted ? "yes" : "no"}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("infers reactivity for &checked target without explicit assignment", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#state-accepted")).toHaveText("Accepted: no")

        await page.locator("#accept-checkbox").check()
        await expect(page.locator("#state-accepted")).toHaveText("Accepted: yes")

        await page.locator("#accept-checkbox").uncheck()
        await expect(page.locator("#state-accepted")).toHaveText("Accepted: no")
    })
})
