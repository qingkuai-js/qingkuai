import type { E2EPageEvaluator, E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import { createStore } from "qingkuai"
            import ThenPanel from "./components/ThenEffectPanel"

            const store = createStore({ count: 0 })
            globalThis.__awaitEffectWatchStore = store
            globalThis.__awaitEffectWatchLeak = { effectRuns: 0, watchRuns: 0 }

            let showHost = true

            const createPendingPromise = () => new Promise(() => {})

            let taskPromise = createPendingPromise()

            const resolveTask = () => {
                taskPromise = new Promise(resolve => {
                    setTimeout(() => resolve("resolved"), 10)
                })
            }

            const resetToPending = () => {
                taskPromise = createPendingPromise()
            }

            const hideHost = () => {
                showHost = false
            }
        </lang-js>

        <section data-page="await-directive-effect-watch-destruction">
            <div>
                <button id="btn-resolve" @click={resolveTask}>Resolve</button>
                <button id="btn-pending" @click={resetToPending}>Reset pending</button>
                <button id="btn-inc" @click={store.count++}>Increment store</button>
                <button id="btn-hide-host" @click={hideHost}>Hide host</button>
            </div>

            <p id="store-count">Store count: {store.count}</p>

            <section id="host" #if={showHost}>
                <p id="await-branch" #await={taskPromise}>Pending...</p>
                <ThenPanel #then={value}>
                    <span id="then-text">Then: {value}</span>
                </ThenPanel>
            </section>
        </section>
    `,
    components: {
        ThenEffectPanel: `
            <lang-js>
                effect(() => {
                    globalThis.__awaitEffectWatchLeak.effectRuns++
                    globalThis.__awaitEffectWatchStore.count
                })

                watch(() => globalThis.__awaitEffectWatchStore.count, () => {
                    globalThis.__awaitEffectWatchLeak.watchRuns++
                })
            </lang-js>

            <article id="then-panel">
                <slot></slot>
            </article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    const readLeak = (page: E2EPageEvaluator) => {
        return page.evaluate(() => {
            return {
                effectRuns: (globalThis as any).__awaitEffectWatchLeak.effectRuns,
                watchRuns: (globalThis as any).__awaitEffectWatchLeak.watchRuns
            }
        })
    }

    test("then-block component effect and watch react to shared store changes while mounted", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#btn-resolve").click()
        await expect(page.locator("#then-panel")).toBeVisible()
        await expect(page.locator("#then-text")).toHaveText("Then: resolved")

        // effect runs once on mount, watch callback waits for the first change
        await expect.poll(() => readLeak(page)).toEqual({ effectRuns: 1, watchRuns: 0 })

        await page.locator("#btn-inc").click()
        await expect(page.locator("#store-count")).toHaveText("Store count: 1")

        await expect.poll(() => readLeak(page)).toEqual({ effectRuns: 2, watchRuns: 1 })
    })

    test("then-block component effect and watch are disposed when the promise resets to pending", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#btn-resolve").click()
        await expect(page.locator("#then-panel")).toBeVisible()
        await expect(page.locator("#then-text")).toHaveText("Then: resolved")

        // Establish a baseline: both effect and watch have fired once after a store change.
        await page.locator("#btn-inc").click()
        await expect(page.locator("#store-count")).toHaveText("Store count: 1")
        await expect.poll(() => readLeak(page)).toEqual({ effectRuns: 2, watchRuns: 1 })

        // Resetting to pending destroys the then block and the component inside it.
        await page.locator("#btn-pending").click()
        await expect(page.locator("#await-branch")).toHaveText("Pending...")
        await expect(page.locator("#then-panel")).toHaveCount(0)

        const beforeReset = await readLeak(page)

        // Changing the store after the then block is gone must not re-trigger the
        // disposed effect/watch.
        await page.locator("#btn-inc").click()
        await expect(page.locator("#store-count")).toHaveText("Store count: 2")

        await expect.poll(() => readLeak(page)).toEqual(beforeReset)
    })

    test("then-block component effect and watch are disposed when the host unmounts", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#btn-resolve").click()
        await expect(page.locator("#then-panel")).toBeVisible()
        await expect(page.locator("#then-text")).toHaveText("Then: resolved")

        await page.locator("#btn-inc").click()
        await expect(page.locator("#store-count")).toHaveText("Store count: 1")
        await expect.poll(() => readLeak(page)).toEqual({ effectRuns: 2, watchRuns: 1 })

        await page.locator("#btn-hide-host").click()
        await expect(page.locator("#host")).toHaveCount(0)
        await expect(page.locator("#then-panel")).toHaveCount(0)

        const beforeUnmount = await readLeak(page)

        await page.locator("#btn-inc").click()
        await expect(page.locator("#store-count")).toHaveText("Store count: 2")

        await expect.poll(() => readLeak(page)).toEqual(beforeUnmount)
    })
})
