import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let spreadItems = [
                { label: "Spread A", action: "Action A" },
                { label: "Spread B", action: "Action B" }
            ]

            const toggleSpreadItems = () => {
                spreadItems = spreadItems.length === 2
                    ? [{ label: "Spread C", action: "Action C" }]
                    : [
                          { label: "Spread A", action: "Action A" },
                          { label: "Spread B", action: "Action B" }
                      ]
            }
        </lang-js>

        <section data-page="for-directive-spread-items">
            <h1 id="for-title">For directive</h1>
            <button id="for-toggle-spread" @click={toggleSpreadItems}>Toggle spread items</button>
            <div id="for-spread-host">
                <qk:spread #for={item of spreadItems}>
                    <span class="for-spread-label">{item.label}</span>
                    <button class="for-spread-action">{item.action}</button>
                </qk:spread>
            </div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports for on qk spread with multi-child rendering", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#for-spread-host .for-spread-label")).toHaveText([
            "Spread A",
            "Spread B"
        ])

        await page.locator("#for-toggle-spread").click()
        await expect(page.locator("#for-spread-host .for-spread-label")).toHaveText(["Spread C"])
    })
})
