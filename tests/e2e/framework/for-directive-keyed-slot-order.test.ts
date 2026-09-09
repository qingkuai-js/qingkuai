import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import SlotList from "./components/SlotList"

            let rows = [
                {
                    id: "a",
                    text: "alpha"
                },
                {
                    id: "b",
                    text: "beta"
                },
                {
                    id: "c",
                    text: "gamma"
                }
            ]

            const moveFirstToEnd = () => {
                rows = [rows[1], rows[2], rows[0]]
            }
        </lang-js>

        <section data-page="for-directive-keyed-slot-order">
            <button id="slot-move-first-to-end" @click={moveFirstToEnd}>move first to end</button>

            <div id="slot-filled">
                <SlotList !rows={rows}>
                    <qk:spread #slot={{ row } from "default"}>
                        <li class="row-item">{row.text}</li>
                    </qk:spread>
                </SlotList>
            </div>

            <div id="slot-fallback">
                <SlotList !rows={rows} />
            </div>
        </section>
    `,
    components: {
        SlotList: `
            <ul class="rows">
                <slot #for={row of props.rows} #key={row.id} !row={row}>
                    <li class="row-fallback">{row.text}</li>
                </slot>
            </ul>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("renders keyed slot outlets in data order on mount", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        const items = page.locator("#slot-filled .row-item")
        await expect(items).toHaveCount(3)
        await expect(items.nth(0)).toHaveText("alpha")
        await expect(items.nth(1)).toHaveText("beta")
        await expect(items.nth(2)).toHaveText("gamma")
    })

    test("keeps keyed slot outlets aligned after reordering", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#slot-move-first-to-end").click()

        const items = page.locator("#slot-filled .row-item")
        await expect(items).toHaveCount(3)
        await expect(items.nth(0)).toHaveText("beta")
        await expect(items.nth(1)).toHaveText("gamma")
        await expect(items.nth(2)).toHaveText("alpha")
    })

    test("renders interpolated default content once per keyed item", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const fallbackItems = page.locator("#slot-fallback .row-fallback")
        await expect(fallbackItems).toHaveCount(3)
        await expect(fallbackItems.nth(0)).toHaveText("alpha")
        await expect(fallbackItems.nth(1)).toHaveText("beta")
        await expect(fallbackItems.nth(2)).toHaveText("gamma")

        await page.locator("#slot-move-first-to-end").click()

        await expect(fallbackItems).toHaveCount(3)
        await expect(fallbackItems.nth(0)).toHaveText("beta")
        await expect(fallbackItems.nth(1)).toHaveText("gamma")
        await expect(fallbackItems.nth(2)).toHaveText("alpha")
    })
})
