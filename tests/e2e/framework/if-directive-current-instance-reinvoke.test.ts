import type { E2EPageEvaluator, E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import { onAfterUpdate, onBeforeUpdate } from "qingkuai"
            import LeafPanel from "./components/LeafPanel"

            let show = true
            let value = 0

            globalThis.__currentInstanceMarks = []

            onBeforeUpdate(() => {
                globalThis.__currentInstanceMarks.push("before")
            })

            onAfterUpdate(() => {
                globalThis.__currentInstanceMarks.push("after")
            })

            const toggle = () => {
                show = !show
            }

            const bump = () => {
                value++
            }
        </lang-js>

        <section data-page="if-directive-current-instance-reinvoke">
            <button id="btn-toggle" @click={toggle}>Toggle branch</button>
            <button id="btn-bump" @click={bump}>Bump value</button>

            <div id="branch-host" #if={show}>
                <LeafPanel />
                <p id="branch-value">Value: {value}</p>
            </div>
        </section>
    `,
    components: {
        LeafPanel: `
            <article id="leaf-panel">Leaf panel</article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    const readMarks = (page: E2EPageEvaluator) => {
        return page.evaluate(() => ((globalThis as any).__currentInstanceMarks as string[]).slice())
    }

    test("parent update hooks still run after if branch remount", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#leaf-panel")).toBeVisible()
        await expect(page.locator("#branch-value")).toHaveText("Value: 0")
        await expect.poll(() => readMarks(page)).toEqual([])

        await page.locator("#btn-bump").click()
        await expect(page.locator("#branch-value")).toHaveText("Value: 1")
        await expect.poll(() => readMarks(page)).toEqual(["before", "after"])

        await page.locator("#btn-toggle").click()
        await expect(page.locator("#branch-host")).toHaveCount(0)

        await page.locator("#btn-toggle").click()
        await expect(page.locator("#leaf-panel")).toBeVisible()
        await expect(page.locator("#branch-value")).toHaveText("Value: 1")

        const previousMarks = await readMarks(page)

        await page.locator("#btn-bump").click()
        await expect(page.locator("#branch-value")).toHaveText("Value: 2")

        const nextMarks = await readMarks(page)
        expect(nextMarks.slice(-2)).toEqual(["before", "after"])
        expect(nextMarks.length).toBe(previousMarks.length + 2)
    })

    test("repeated remount cycles keep update hook ownership on current instance", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        for (let i = 0; i < 3; i++) {
            await page.locator("#btn-toggle").click()
            await expect(page.locator("#branch-host")).toHaveCount(0)

            await page.locator("#btn-toggle").click()
            await expect(page.locator("#leaf-panel")).toBeVisible()

            const previousMarks = await readMarks(page)

            await page.locator("#btn-bump").click()

            const nextMarks = await readMarks(page)
            expect(nextMarks.slice(-2)).toEqual(["before", "after"])
            expect(nextMarks.length).toBe(previousMarks.length + 2)
        }
    })
})
