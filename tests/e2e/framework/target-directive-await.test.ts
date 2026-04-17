import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            const createPendingPromise = () => new Promise(() => {})
            let awaitTarget = null
            let awaitValuePromise = createPendingPromise()

            const moveAwaitToA = () => {
                awaitTarget = "#target-dest-a"
            }

            const resolveAwaitBranch = () => {
                awaitValuePromise = new Promise(resolve => {
                    setTimeout(() => resolve("Await resolved"), 10)
                })
            }
        </lang-js>

        <section data-page="target-directive-await">
            <h1 id="target-title">Target directive</h1>
            <div>
                <button id="target-await-to-a" @click={moveAwaitToA}>Await to A</button>
                <button id="target-await-resolve" @click={resolveAwaitBranch}>Await resolve</button>
            </div>
            <div id="target-await-source">
                <p id="target-await-pending" #await={awaitValuePromise} #target={awaitTarget}>Await pending</p>
                <p id="target-await-then" #then={msg} #target={awaitTarget}>{msg}</p>
                <p id="target-await-catch" #catch={err} #target={awaitTarget}>{err}</p>
            </div>
            <div id="target-dest-a"></div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports target directive combined with await", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#target-await-to-a").click()
        await expect(page.locator("#target-dest-a #target-await-pending")).toHaveText(
            "Await pending"
        )

        await page.locator("#target-await-resolve").click()
        await expect(page.locator("#target-dest-a #target-await-then")).toHaveText("Await resolved")
        await expect(page.locator("#target-dest-a #target-await-pending")).toHaveCount(0)
    })
})
