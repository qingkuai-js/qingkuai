import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let repeatItems = [1, 2, 3]
            const items = [
                { id: 1, label: "Alpha" },
                { id: 2, label: "Beta" }
            ]
        </lang-js>

        <section data-page="for-directive-list">
            <h1 id="for-title">For directive</h1>

            <ul id="for-basic-list">
                <li
                    #for={item, index of items}
                    #key={item.id}
                    class="for-basic-item"
                    !data-id={item.id}
                >
                    {index}:{item.label}
                </li>
            </ul>

            <ul id="for-destructure-list">
                <li
                    #for={{ id, label } of items}
                    class="for-destructure-item"
                >
                    {id}-{label}
                </li>
            </ul>

            <div id="for-repeat-host">
                <span
                    #for={n of repeatItems}
                    class="for-repeat-item"
                >
                    {n}
                </span>
            </div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("renders basic list, destructuring list, and numeric repeat list", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page).toHaveTitle("for-directive-list")
        await expect(page.locator("#for-basic-list .for-basic-item")).toHaveText([
            "0:Alpha",
            "1:Beta"
        ])
        await expect(page.locator("#for-destructure-list .for-destructure-item")).toHaveText([
            "1-Alpha",
            "2-Beta"
        ])
        await expect(page.locator("#for-repeat-host .for-repeat-item")).toHaveCount(3)
    })
})
