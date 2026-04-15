import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let outer = 0
            let middle = 0
            let leaf = 0

            const incOuter = () => {
                outer++
            }

            const incMiddle = () => {
                middle++
            }

            const incLeaf = () => {
                leaf++
            }
        </lang-js>

        <section data-page="event-binding-stop-ancestor-chain">
            <div
                id="outer"
                style="width: 220px; height: 220px; padding: 10px;"
                @click={incOuter}
            >
                <div
                    id="middle"
                    style="width: 100px; height: 100px;"
                    @click|stop={incMiddle}
                >
                    <button
                        id="leaf"
                        @click={incLeaf}
                    >
                        Click
                    </button>
                </div>
            </div>
            <p id="counts">{outer}-{middle}-{leaf}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("stop on middle ancestor blocks further bubbling", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#leaf").click()
        await expect(page.locator("#counts")).toHaveText("0-1-1")

        await page.locator("#outer").click({ position: { x: 210, y: 210 } })
        await expect(page.locator("#counts")).toHaveText("1-1-1")
    })
})
