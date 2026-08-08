import type { E2EPageEvaluator, E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import { createStore } from "qingkuai"

            const store = createStore({ count: 0 })
            globalThis.__asyncEffectWatchStore = store
            globalThis.__asyncEffectWatchLeak = { effectRuns: 0, watchRuns: 0 }

            let showHost = true

            const createPendingPromise = () => new Promise(() => {})

            let asyncComponentPromise = createPendingPromise()

            const loadComponent = () => {
                asyncComponentPromise = import("./components/EffectWatchPanel")
            }

            const hideHost = () => {
                showHost = false
            }

            const showHostAgain = () => {
                showHost = true
            }
        </lang-js>

        <section data-page="async-components-effect-watch-lifecycle">
            <div>
                <button id="btn-load" @click={loadComponent}>Load component</button>
                <button id="btn-inc" @click={store.count++}>Increment store</button>
                <button id="btn-hide-host" @click={hideHost}>Hide host</button>
                <button id="btn-show-host" @click={showHostAgain}>Show host</button>
            </div>

            <p id="store-count">Store count: {store.count}</p>

            <section id="host" #if={showHost}>
                <div id="async-loading" #await={asyncComponentPromise}>Loading...</div>
                <qk:spread #then={Module}>
                    <Module.default />
                </qk:spread>
            </section>
        </section>
    `,
    components: {
        EffectWatchPanel: `
            <lang-js>
                effect(() => {
                    globalThis.__asyncEffectWatchLeak.effectRuns++
                    globalThis.__asyncEffectWatchStore.count
                })

                watch(() => globalThis.__asyncEffectWatchStore.count, () => {
                    globalThis.__asyncEffectWatchLeak.watchRuns++
                })
            </lang-js>

            <article id="effect-watch-panel">Effect watch panel</article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    const readLeak = (page: E2EPageEvaluator) => {
        return page.evaluate(() => {
            return {
                effectRuns: (globalThis as any).__asyncEffectWatchLeak.effectRuns,
                watchRuns: (globalThis as any).__asyncEffectWatchLeak.watchRuns
            }
        })
    }

    test("effect and watch created in async component setup react to shared store changes", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#btn-load").click()
        await expect(page.locator("#effect-watch-panel")).toHaveText("Effect watch panel")

        // effect runs once on mount, watch callback waits for the first change
        await expect.poll(() => readLeak(page)).toEqual({ effectRuns: 1, watchRuns: 0 })

        await page.locator("#btn-inc").click()
        await expect(page.locator("#store-count")).toHaveText("Store count: 1")

        await expect.poll(() => readLeak(page)).toEqual({ effectRuns: 2, watchRuns: 1 })
    })

    test("effect and watch are disposed when the async component host unmounts", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#btn-load").click()
        await expect(page.locator("#effect-watch-panel")).toHaveText("Effect watch panel")

        // Establish a baseline: both effect and watch have fired once after a store change.
        await page.locator("#btn-inc").click()
        await expect(page.locator("#store-count")).toHaveText("Store count: 1")
        await expect.poll(() => readLeak(page)).toEqual({ effectRuns: 2, watchRuns: 1 })

        await page.locator("#btn-hide-host").click()
        await expect(page.locator("#host")).toHaveCount(0)
        await expect(page.locator("#effect-watch-panel")).toHaveCount(0)

        const beforeUnmount = await readLeak(page)

        // Changing the store after the host is gone must not re-trigger the disposed
        // effect/watch; the store text still updates because the root is alive.
        await page.locator("#btn-inc").click()
        await expect(page.locator("#store-count")).toHaveText("Store count: 2")

        await expect.poll(() => readLeak(page)).toEqual(beforeUnmount)
    })

    test("effect and watch are re-created when the async component host remounts", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#btn-load").click()
        await expect(page.locator("#effect-watch-panel")).toHaveText("Effect watch panel")

        await page.locator("#btn-hide-host").click()
        await expect(page.locator("#host")).toHaveCount(0)

        const beforeRemount = await readLeak(page)

        await page.locator("#btn-show-host").click()
        await expect(page.locator("#effect-watch-panel")).toHaveText("Effect watch panel")

        // A fresh component instance registers fresh effect/watch on remount.
        await expect
            .poll(() => readLeak(page))
            .toEqual({
                effectRuns: beforeRemount.effectRuns + 1,
                watchRuns: beforeRemount.watchRuns
            })

        await page.locator("#btn-inc").click()
        await expect(page.locator("#store-count")).toHaveText("Store count: 1")

        await expect
            .poll(() => readLeak(page))
            .toEqual({
                effectRuns: beforeRemount.effectRuns + 2,
                watchRuns: beforeRemount.watchRuns + 1
            })
    })
})
