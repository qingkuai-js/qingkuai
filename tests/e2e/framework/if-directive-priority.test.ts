import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let showList = false
            let showSpread = false
            const items = [
                { id: 1, label: "Alpha" },
                { id: 2, label: "Beta" }
            ]

            const toggleList = () => {
                showList = !showList
            }

            const toggleSpread = () => {
                showSpread = !showSpread
            }
        </lang-js>

        <section data-page="if-directive-priority">
            <h1 id="if-title">If directive</h1>

            <button
                id="toggle-list"
                @click={toggleList()}
            >
                Toggle list
            </button>
            <button
                id="toggle-spread"
                @click={toggleSpread()}
            >
                Toggle spread
            </button>

            <ul id="if-for-list">
                <li
                    #if={showList}
                    #for={item of items}
                    #key={item.id}
                    class="if-for-item"
                >
                    {item.label}
                </li>
            </ul>

            <div id="spread-host">
                <qk:spread #if={showSpread}>
                    Spread text
                    <p id="spread-copy">Spread copy</p>
                </qk:spread>
            </div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("if has higher priority than for on the same tag", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page).toHaveTitle("if-directive-priority")
        await expect(page.locator("#if-title")).toHaveText("If directive")
        await expect(page.locator("#if-for-list .if-for-item")).toHaveCount(0)

        await page.locator("#toggle-list").click()
        await expect(page.locator("#if-for-list .if-for-item")).toHaveText(["Alpha", "Beta"])

        await page.locator("#toggle-list").click()
        await expect(page.locator("#if-for-list .if-for-item")).toHaveCount(0)
    })

    test("supports if on qk spread", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#spread-copy")).toHaveCount(0)

        await page.locator("#toggle-spread").click()
        await expect(page.locator("#spread-host")).toContainText("Spread text")
        await expect(page.locator("#spread-copy")).toHaveText("Spread copy")

        await page.locator("#toggle-spread").click()
        await expect(page.locator("#spread-copy")).toHaveCount(0)
    })
})
