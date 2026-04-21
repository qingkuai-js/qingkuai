import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let isActive = true
            let isHidden = true

            const toggleFlags = () => {
                isActive = !isActive
                isHidden = !isHidden
            }
        </lang-js>

        <section data-page="attribute-boolean-toggle">
            <div id="target" !data-active={isActive} !hidden={isHidden}>target</div>

            <button id="toggle-flags" @click={toggleFlags}>Toggle flags</button>

            <p id="state-active">Active: {isActive ? "yes" : "no"}</p>
            <p id="state-hidden">Hidden: {isHidden ? "yes" : "no"}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("toggles boolean attributes with add/remove semantics", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#target")).toHaveAttribute("data-active", "")
        await expect(page.locator("#target")).toHaveAttribute("hidden", "")
        await expect(page.locator("#state-active")).toHaveText("Active: yes")
        await expect(page.locator("#state-hidden")).toHaveText("Hidden: yes")

        await page.locator("#toggle-flags").click()

        await expect(page.locator("#state-active")).toHaveText("Active: no")
        await expect(page.locator("#state-hidden")).toHaveText("Hidden: no")
        await expect(page.locator("#target")).not.toHaveAttribute("data-active", /.+/)
        await expect(page.locator("#target")).not.toHaveAttribute("hidden", /.+/)

        await page.locator("#toggle-flags").click()

        await expect(page.locator("#state-active")).toHaveText("Active: yes")
        await expect(page.locator("#state-hidden")).toHaveText("Hidden: yes")
        await expect(page.locator("#target")).toHaveAttribute("data-active", "")
        await expect(page.locator("#target")).toHaveAttribute("hidden", "")
    })
})
