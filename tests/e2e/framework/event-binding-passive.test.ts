import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
        let normalCount = 0
            let passiveCount = 0

            const incPassive = () => {
                passiveCount++
            }

            const incNormal = () => {
                normalCount++
            }
        </lang-js>

        <section data-page="event-binding-passive">
            <div
                id="outer"
                @pointerdown|passive={incPassive()}
            >
                <button
                    id="inner"
                    @pointerdown={incNormal}
                >
                    Press
                </button>
            </div>
            <p id="passive-count">{passiveCount}</p>
            <p id="normal-count">{normalCount}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("passive and non-passive handlers run exactly once each", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#inner").dispatchEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
            pointerType: "mouse"
        })

        await expect(page.locator("#normal-count")).toHaveText("1")
        await expect(page.locator("#passive-count")).toHaveText("1")
    })
})
