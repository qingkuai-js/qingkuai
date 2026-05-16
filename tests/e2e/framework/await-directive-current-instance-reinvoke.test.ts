import type { E2EPageEvaluator, E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import { onAfterUpdate, onBeforeUpdate } from "qingkuai"

            let sequence = 0
            let tick = 0

            globalThis.__awaitInstanceMarks = []

            onBeforeUpdate(() => {
                globalThis.__awaitInstanceMarks.push("before")
            })

            onAfterUpdate(() => {
                globalThis.__awaitInstanceMarks.push("after")
            })

            const makeResolved = (value) => {
                return new Promise(resolve => {
                    setTimeout(() => resolve(value), 10)
                })
            }

            const makeRejected = (value) => {
                return new Promise((_, reject) => {
                    setTimeout(() => reject(value), 10)
                })
            }

            let taskPromise = makeResolved("seed")

            const resolveTask = () => {
                sequence++
                taskPromise = makeResolved("ok-" + sequence)
            }

            const rejectTask = () => {
                sequence++
                taskPromise = makeRejected("err-" + sequence)
            }

            const setPending = () => {
                taskPromise = new Promise(() => {})
            }

            const bumpTick = () => {
                tick++
            }
        </lang-js>

        <section data-page="await-directive-current-instance-reinvoke">
            <button id="btn-resolve" @click={resolveTask}>Resolve</button>
            <button id="btn-reject" @click={rejectTask}>Reject</button>
            <button id="btn-pending" @click={setPending}>Pending</button>
            <button id="btn-bump" @click={bumpTick}>Bump tick</button>

            <p id="tick-text">Tick: {tick}</p>

            <div id="await-host">
                <p id="await-branch" #await={taskPromise}>Pending...</p>
                <p id="then-branch" #then={value}>Then: {value}</p>
                <p id="catch-branch" #catch={reason}>Catch: {reason}</p>
            </div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    const readMarks = (page: E2EPageEvaluator) => {
        return page.evaluate(() => ((globalThis as any).__awaitInstanceMarks as string[]).slice())
    }

    test("await branch transitions do not break later parent update hooks", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#btn-resolve").click()
        await expect(page.locator("#then-branch")).toHaveText("Then: ok-1")

        const marksBeforeFirstBump = await readMarks(page)
        await page.locator("#btn-bump").click()
        await expect(page.locator("#tick-text")).toHaveText("Tick: 1")

        const marksAfterFirstBump = await readMarks(page)
        expect(marksAfterFirstBump.slice(-2)).toEqual(["before", "after"])
        expect(marksAfterFirstBump.length).toBeGreaterThanOrEqual(marksBeforeFirstBump.length + 2)

        await page.locator("#btn-reject").click()
        await expect(page.locator("#catch-branch")).toHaveText("Catch: err-2")

        const marksBeforeSecondBump = await readMarks(page)
        await page.locator("#btn-bump").click()
        await expect(page.locator("#tick-text")).toHaveText("Tick: 2")

        const marksAfterSecondBump = await readMarks(page)
        expect(marksAfterSecondBump.slice(-2)).toEqual(["before", "after"])
        expect(marksAfterSecondBump.length).toBeGreaterThanOrEqual(marksBeforeSecondBump.length + 2)
    })

    test("repeated pending and settled transitions keep current instance tracking stable", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        for (let i = 0; i < 3; i++) {
            await page.locator("#btn-pending").click()
            await expect(page.locator("#await-branch")).toHaveText("Pending...")

            await page.locator("#btn-resolve").click()
            await expect(page.locator("#then-branch")).toHaveText("Then: ok-" + (i + 1))

            const marksBeforeBump = await readMarks(page)
            await page.locator("#btn-bump").click()
            await expect(page.locator("#tick-text")).toHaveText("Tick: " + (i + 1))

            const marksAfterBump = await readMarks(page)
            expect(marksAfterBump.slice(-2)).toEqual(["before", "after"])
            expect(marksAfterBump.length).toBeGreaterThanOrEqual(marksBeforeBump.length + 2)
        }
    })
})
