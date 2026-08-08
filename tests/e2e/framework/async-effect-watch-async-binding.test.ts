import type { E2EPageEvaluator, E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import { createStore } from "qingkuai"
            import ManualPanel from "./components/ManualCleanupPanel"

            const store = createStore({ count: 0 })
            globalThis.__manualCleanupStore = store
            globalThis.__manualCleanupLeak = { effectRuns: 0, watchRuns: 0 }

            let showPanel = false

            const showPanelFn = () => {
                showPanel = true
            }

            const hidePanelFn = () => {
                showPanel = false
            }
        </lang-js>

        <section data-page="async-effect-watch-async-binding">
            <div>
                <button id="btn-show" @click={showPanelFn}>Show panel</button>
                <button id="btn-hide" @click={hidePanelFn}>Hide panel</button>
                <button id="btn-inc" @click={store.count++}>Increment store</button>
            </div>

            <p id="store-count">Store count: {store.count}</p>

            <ManualPanel #if={showPanel} />
        </section>
    `,
    components: {
        ManualCleanupPanel: `
            <lang-js>
                const registerAsync = async () => {
                    await Promise.resolve()
                    effect(() => {
                        globalThis.__manualCleanupLeak.effectRuns++
                        globalThis.__manualCleanupStore.count
                    })
                    watch(() => globalThis.__manualCleanupStore.count, () => {
                        globalThis.__manualCleanupLeak.watchRuns++
                    })
                }
                registerAsync()
            </lang-js>

            <article id="manual-panel">Manual cleanup panel</article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    const readLeak = (page: E2EPageEvaluator) => {
        return page.evaluate(() => {
            return {
                effectRuns: (globalThis as any).__manualCleanupLeak.effectRuns,
                watchRuns: (globalThis as any).__manualCleanupLeak.watchRuns
            }
        })
    }

    test("effect and watch registered asynchronously still react to shared store changes", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#btn-show").click()
        await expect(page.locator("#manual-panel")).toHaveText("Manual cleanup panel")

        // Wait until the async registration completed (effect ran once).
        await expect.poll(() => readLeak(page)).toEqual({ effectRuns: 1, watchRuns: 0 })

        await page.locator("#btn-inc").click()
        await expect(page.locator("#store-count")).toHaveText("Store count: 1")

        await expect.poll(() => readLeak(page)).toEqual({ effectRuns: 2, watchRuns: 1 })
    })

    test("async-registered effect and watch are auto-bound and disposed on destroy", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#btn-show").click()
        await expect(page.locator("#manual-panel")).toHaveText("Manual cleanup panel")

        // Wait until the async registration completed and both fired once after a change.
        await expect.poll(() => readLeak(page)).toEqual({ effectRuns: 1, watchRuns: 0 })
        await page.locator("#btn-inc").click()
        await expect(page.locator("#store-count")).toHaveText("Store count: 1")
        await expect.poll(() => readLeak(page)).toEqual({ effectRuns: 2, watchRuns: 1 })

        await page.locator("#btn-hide").click()
        await expect(page.locator("#manual-panel")).toHaveCount(0)

        const beforeUnmount = await readLeak(page)
        await page.locator("#btn-inc").click()
        await expect(page.locator("#store-count")).toHaveText("Store count: 2")

        await expect.poll(() => readLeak(page)).toEqual(beforeUnmount)
    })
})
