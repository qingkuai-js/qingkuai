import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let spreadBranch = "else"

            const cycleSpreadBranch = () => {
                spreadBranch = spreadBranch === "else"
                    ? "if"
                    : spreadBranch === "if"
                        ? "elif"
                        : "else"
            }
        </lang-js>

        <section data-page="if-directive-spread-branches">
            <h1 id="if-title">If directive</h1>

            <button
                id="cycle-spread-branch"
                @click={cycleSpreadBranch}
            >
                Cycle spread branch
            </button>

            <div id="spread-branch-host">
                <qk:spread #if={spreadBranch === "if"}>
                    Spread if text
                    <span id="spread-branch-if">If branch</span>
                </qk:spread>
                <qk:spread #elif={spreadBranch === "elif"}>
                    <span id="spread-branch-elif">Elif branch</span>
                    Spread elif text
                </qk:spread>
                <qk:spread #else>
                    <span id="spread-branch-else">Else branch</span>
                    Spread else text
                </qk:spread>
            </div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports qk spread if elif else branch switching", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#spread-branch-else")).toHaveText("Else branch")

        await page.locator("#cycle-spread-branch").click()
        await expect(page.locator("#spread-branch-if")).toHaveText("If branch")

        await page.locator("#cycle-spread-branch").click()
        await expect(page.locator("#spread-branch-elif")).toHaveText("Elif branch")

        await page.locator("#cycle-spread-branch").click()
        await expect(page.locator("#spread-branch-else")).toHaveText("Else branch")
    })
})
