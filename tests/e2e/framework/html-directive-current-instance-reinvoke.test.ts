import type { E2EPageEvaluator, E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import { onAfterUpdate, onBeforeUpdate } from "qingkuai"

            let htmlText = '<span id="html-a">A</span>'
            let tick = 0

            globalThis.__htmlInstanceMarks = []

            onBeforeUpdate(() => {
                globalThis.__htmlInstanceMarks.push("before")
            })

            onAfterUpdate(() => {
                globalThis.__htmlInstanceMarks.push("after")
            })

            const toggleHtml = () => {
                htmlText = htmlText.includes("html-a")
                    ? '<span id="html-b">B</span>'
                    : '<span id="html-a">A</span>'
            }

            const bumpTick = () => {
                tick++
            }
        </lang-js>

        <section data-page="html-directive-current-instance-reinvoke">
            <button id="btn-toggle-html" @click={toggleHtml}>Toggle html</button>
            <button id="btn-bump" @click={bumpTick}>Bump tick</button>

            <div id="html-host" #html>{htmlText}</div>
            <p id="tick-text">Tick: {tick}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    const readMarks = (page: E2EPageEvaluator) => {
        return page.evaluate(() => ((globalThis as any).__htmlInstanceMarks as string[]).slice())
    }

    test("html directive reinvocation keeps parent update hook ownership", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#html-host #html-a")).toHaveText("A")
        await expect(page.locator("#tick-text")).toHaveText("Tick: 0")
        await expect.poll(() => readMarks(page)).toEqual([])

        await page.locator("#btn-bump").click()
        await expect(page.locator("#tick-text")).toHaveText("Tick: 1")

        const marksAfterFirstBump = await readMarks(page)
        expect(marksAfterFirstBump.slice(-2)).toEqual(["before", "after"])

        await page.locator("#btn-toggle-html").click()
        await expect(page.locator("#html-host #html-b")).toHaveText("B")

        const marksBeforeSecondBump = await readMarks(page)
        await page.locator("#btn-bump").click()
        await expect(page.locator("#tick-text")).toHaveText("Tick: 2")

        const marksAfterSecondBump = await readMarks(page)
        expect(marksAfterSecondBump.slice(-2)).toEqual(["before", "after"])
        expect(marksAfterSecondBump.length).toBeGreaterThanOrEqual(marksBeforeSecondBump.length + 2)
    })

    test("multiple html toggles keep update hooks stable", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        for (let i = 0; i < 3; i++) {
            await page.locator("#btn-toggle-html").click()
            const marksBeforeBump = await readMarks(page)

            await page.locator("#btn-bump").click()
            await expect(page.locator("#tick-text")).toHaveText("Tick: " + (i + 1))

            const marksAfterBump = await readMarks(page)
            expect(marksAfterBump.slice(-2)).toEqual(["before", "after"])
            expect(marksAfterBump.length).toBeGreaterThanOrEqual(marksBeforeBump.length + 2)
        }
    })
})
