import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            const groups = [
                { name: "Group A", entries: ["A1", "A2"] },
                { name: "Group B", entries: ["B1"] }
            ]

            const appendGroupEntry = () => {
                groups[0].entries.push("A" + (groups[0].entries.length + 1))
            }
        </lang-js>

        <section data-page="for-directive-nested-groups">
            <h1 id="for-title">For directive</h1>
            <button id="for-append-group-entry" @click={appendGroupEntry}>Append group entry</button>
            <ul id="for-nested-groups">
                <li #for={group of groups} class="for-group-item">
                    <h3 class="for-group-title">{group.name}</h3>
                    <ul class="for-group-entries">
                        <li #for={entry of group.entries} class="for-group-entry">{entry}</li>
                    </ul>
                </li>
            </ul>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports nested for blocks and inner-list updates", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#for-nested-groups .for-group-title")).toHaveText([
            "Group A",
            "Group B"
        ])

        await page.locator("#for-append-group-entry").click()
        await expect(
            page.locator("#for-nested-groups .for-group-item").first().locator(".for-group-entry")
        ).toHaveText(["A1", "A2", "A3"])
    })
})
