import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let tab = 0
            let del = 0
            let space = 0
            let up = 0
            let down = 0
            let left = 0
            let right = 0

            const incTab = () => {
                tab++
            }

            const incDel = () => {
                del++
            }

            const incSpace = () => {
                space++
            }

            const incUp = () => {
                up++
            }

            const incDown = () => {
                down++
            }

            const incLeft = () => {
                left++
            }

            const incRight = () => {
                right++
            }
        </lang-js>

        <section data-page="event-binding-key-aliases">
            <input
                id="tab-input"
                @keydown|tab={incTab}
            />
            <input
                id="delete-input"
                @keydown|delete={incDel}
            />
            <input
                id="space-input"
                @keydown|space={incSpace}
            />
            <input
                id="up-input"
                @keydown|up={incUp}
            />
            <input
                id="down-input"
                @keydown|down={incDown}
            />
            <input
                id="left-input"
                @keydown|left={incLeft}
            />
            <input
                id="right-input"
                @keydown|right={incRight}
            />
            <p id="counts">{tab}-{del}-{space}-{up}-{down}-{left}-{right}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("key aliases tab/delete/space/arrows all work", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#tab-input").press("Tab")
        await page.locator("#delete-input").press("Delete")
        await page.locator("#space-input").press("Space")
        await page.locator("#up-input").press("ArrowUp")
        await page.locator("#down-input").press("ArrowDown")
        await page.locator("#left-input").press("ArrowLeft")
        await page.locator("#right-input").press("ArrowRight")
        await expect(page.locator("#counts")).toHaveText("1-1-1-1-1-1-1")
    })
})
