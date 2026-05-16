import type { E2EPageEvaluator, E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import { onAfterUpdate, onBeforeUpdate } from "qingkuai"
            import RowPanel from "./components/RowPanel"

            let nextId = 2
            let tick = 0
            let items = [
                { id: 1, label: "Alpha" },
                { id: 2, label: "Beta" }
            ]

            globalThis.__forInstanceMarks = []

            onBeforeUpdate(() => {
                globalThis.__forInstanceMarks.push("before")
            })

            onAfterUpdate(() => {
                globalThis.__forInstanceMarks.push("after")
            })

            const addItem = () => {
                nextId++
                items = [...items, { id: nextId, label: "Item " + nextId }]
            }

            const removeFirst = () => {
                if (items.length) {
                    items = items.slice(1)
                }
            }

            const bumpTick = () => {
                tick++
            }
        </lang-js>

        <section data-page="for-directive-current-instance-reinvoke">
            <button id="btn-add" @click={addItem}>Add item</button>
            <button id="btn-remove" @click={removeFirst}>Remove first</button>
            <button id="btn-bump" @click={bumpTick}>Bump tick</button>

            <div id="list-host">
                <RowPanel
                    #for={item of items}
                    #key={item.id}
                    !label={item.label}
                />
            </div>

            <p id="tick-text">Tick: {tick}</p>
        </section>
    `,
    components: {
        RowPanel: `
            <article class="row-panel">{props.label}</article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    const readMarks = (page: E2EPageEvaluator) => {
        return page.evaluate(() => ((globalThis as any).__forInstanceMarks as string[]).slice())
    }

    test("parent update hooks still fire after for branch mounts new rows", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const rowPanels = page.locator("#list-host .row-panel")
        await expect(rowPanels).toHaveCount(2)
        await expect(page.locator("#list-host")).toContainText("Alpha")
        await expect(page.locator("#list-host")).toContainText("Beta")
        await expect(page.locator("#tick-text")).toHaveText("Tick: 0")
        await expect.poll(() => readMarks(page)).toEqual([])

        await page.locator("#btn-bump").click()
        await expect(page.locator("#tick-text")).toHaveText("Tick: 1")

        const marksAfterFirstBump = await readMarks(page)
        expect(marksAfterFirstBump.slice(-2)).toEqual(["before", "after"])

        await page.locator("#btn-add").click()
        await expect(rowPanels).toHaveCount(3)
        await expect(page.locator("#list-host")).toContainText("Item 3")

        const marksBeforeSecondBump = await readMarks(page)
        await page.locator("#btn-bump").click()
        await expect(page.locator("#tick-text")).toHaveText("Tick: 2")

        const marksAfterSecondBump = await readMarks(page)
        expect(marksAfterSecondBump.slice(-2)).toEqual(["before", "after"])
        expect(marksAfterSecondBump.length).toBeGreaterThanOrEqual(marksBeforeSecondBump.length + 2)

        await page.locator("#btn-remove").click()
        await expect(rowPanels).toHaveCount(2)

        const marksBeforeThirdBump = await readMarks(page)
        await page.locator("#btn-bump").click()
        await expect(page.locator("#tick-text")).toHaveText("Tick: 3")

        const marksAfterThirdBump = await readMarks(page)
        expect(marksAfterThirdBump.slice(-2)).toEqual(["before", "after"])
        expect(marksAfterThirdBump.length).toBeGreaterThanOrEqual(marksBeforeThirdBump.length + 2)
    })

    test("repeated list growth and shrink cycles keep current instance ownership", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const rowPanels = page.locator("#list-host .row-panel")

        for (let i = 0; i < 3; i++) {
            await page.locator("#btn-add").click()
            await expect(rowPanels).toHaveCount(3)

            await page.locator("#btn-remove").click()
            await expect(rowPanels).toHaveCount(2)

            const marksBeforeBump = await readMarks(page)

            await page.locator("#btn-bump").click()
            await expect(page.locator("#tick-text")).toHaveText("Tick: " + (i + 1))

            const marksAfterBump = await readMarks(page)
            expect(marksAfterBump.slice(-2)).toEqual(["before", "after"])
            expect(marksAfterBump.length).toBeGreaterThanOrEqual(marksBeforeBump.length + 2)
        }
    })
})
