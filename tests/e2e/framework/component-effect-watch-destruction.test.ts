import type { E2EPageEvaluator, E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import { createStore } from "qingkuai"
            import SyncPanel from "./components/SyncEffectWatchPanel"

            const store = createStore({ count: 0 })
            globalThis.__syncEffectWatchStore = store
            globalThis.__syncEffectWatchLeak = {
                effect: 0,
                preEffect: 0,
                postEffect: 0,
                syncEffect: 0,
                watch: 0,
                preWatch: 0,
                postWatch: 0,
                syncWatch: 0
            }

            let showPanel = false

            const showPanelFn = () => {
                showPanel = true
            }

            const hidePanelFn = () => {
                showPanel = false
            }
        </lang-js>

        <section data-page="component-effect-watch-destruction">
            <div>
                <button id="btn-show" @click={showPanelFn}>Show panel</button>
                <button id="btn-hide" @click={hidePanelFn}>Hide panel</button>
                <button id="btn-inc" @click={store.count++}>Increment store</button>
            </div>

            <p id="store-count">Store count: {store.count}</p>

            <SyncPanel #if={showPanel} />
        </section>
    `,
    components: {
        SyncEffectWatchPanel: `
            <lang-js>
                effect(() => {
                    globalThis.__syncEffectWatchLeak.effect++
                    globalThis.__syncEffectWatchStore.count
                })
                preEffect(() => {
                    globalThis.__syncEffectWatchLeak.preEffect++
                    globalThis.__syncEffectWatchStore.count
                })
                postEffect(() => {
                    globalThis.__syncEffectWatchLeak.postEffect++
                    globalThis.__syncEffectWatchStore.count
                })
                syncEffect(() => {
                    globalThis.__syncEffectWatchLeak.syncEffect++
                    globalThis.__syncEffectWatchStore.count
                })
                watch(() => globalThis.__syncEffectWatchStore.count, () => {
                    globalThis.__syncEffectWatchLeak.watch++
                })
                preWatch(() => globalThis.__syncEffectWatchStore.count, () => {
                    globalThis.__syncEffectWatchLeak.preWatch++
                })
                postWatch(() => globalThis.__syncEffectWatchStore.count, () => {
                    globalThis.__syncEffectWatchLeak.postWatch++
                })
                syncWatch(() => globalThis.__syncEffectWatchStore.count, () => {
                    globalThis.__syncEffectWatchLeak.syncWatch++
                })
            </lang-js>

            <article id="sync-panel">Sync effect watch panel</article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    const readLeak = (page: E2EPageEvaluator) => {
        return page.evaluate(() => {
            return { ...(globalThis as any).__syncEffectWatchLeak }
        })
    }

    test("all effect/watch timing variants register in sync setup and react to store changes", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#btn-show").click()
        await expect(page.locator("#sync-panel")).toHaveText("Sync effect watch panel")

        // On mount each effect variant runs once; watchers wait for the first change.
        await expect
            .poll(() => readLeak(page))
            .toEqual({
                effect: 1,
                preEffect: 1,
                postEffect: 1,
                syncEffect: 1,
                watch: 0,
                preWatch: 0,
                postWatch: 0,
                syncWatch: 0
            })

        await page.locator("#btn-inc").click()
        await expect(page.locator("#store-count")).toHaveText("Store count: 1")

        await expect
            .poll(() => readLeak(page))
            .toEqual({
                effect: 2,
                preEffect: 2,
                postEffect: 2,
                syncEffect: 2,
                watch: 1,
                preWatch: 1,
                postWatch: 1,
                syncWatch: 1
            })
    })

    test("all effect/watch timing variants are disposed when the sync component unmounts", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#btn-show").click()
        await expect(page.locator("#sync-panel")).toHaveText("Sync effect watch panel")

        // Establish a baseline where every variant fired once after a change.
        await page.locator("#btn-inc").click()
        await expect(page.locator("#store-count")).toHaveText("Store count: 1")
        await expect
            .poll(() => readLeak(page))
            .toEqual({
                effect: 2,
                preEffect: 2,
                postEffect: 2,
                syncEffect: 2,
                watch: 1,
                preWatch: 1,
                postWatch: 1,
                syncWatch: 1
            })

        await page.locator("#btn-hide").click()
        await expect(page.locator("#sync-panel")).toHaveCount(0)

        const beforeUnmount = await readLeak(page)

        await page.locator("#btn-inc").click()
        await expect(page.locator("#store-count")).toHaveText("Store count: 2")

        // Disposed effect/watch must not re-fire.
        await expect.poll(() => readLeak(page)).toEqual(beforeUnmount)
    })
})
