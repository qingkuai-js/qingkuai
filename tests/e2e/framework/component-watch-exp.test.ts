import type { E2EPageEvaluator, E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import { createStore } from "qingkuai"
            import WatchExpPanel from "./components/WatchExpPanel"

            const store = createStore({ count: 0 })
            globalThis.__watchExpStore = store
            globalThis.__watchExpLeak = {
                watchExp: 0,
                preWatchExp: 0,
                postWatchExp: 0,
                syncWatchExp: 0
            }

            let showPanel = false

            const showPanelFn = () => {
                showPanel = true
            }

            const hidePanelFn = () => {
                showPanel = false
            }
        </lang-js>

        <section data-page="component-watch-exp">
            <div>
                <button id="btn-show" @click={showPanelFn}>Show panel</button>
                <button id="btn-hide" @click={hidePanelFn}>Hide panel</button>
                <button id="btn-inc" @click={store.count++}>Increment store</button>
            </div>

            <p id="store-count">Store count: {store.count}</p>

            <WatchExpPanel #if={showPanel} />
        </section>
    `,
    components: {
        WatchExpPanel: `
            <lang-js>
                watchExp(globalThis.__watchExpStore.count, () => {
                    globalThis.__watchExpLeak.watchExp++
                })
                preWatchExp(globalThis.__watchExpStore.count, () => {
                    globalThis.__watchExpLeak.preWatchExp++
                })
                postWatchExp(globalThis.__watchExpStore.count, () => {
                    globalThis.__watchExpLeak.postWatchExp++
                })
                syncWatchExp(globalThis.__watchExpStore.count, () => {
                    globalThis.__watchExpLeak.syncWatchExp++
                })
            </lang-js>

            <article id="watch-exp-panel">Watch exp panel</article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    const readLeak = (page: E2EPageEvaluator) => {
        return page.evaluate(() => {
            return { ...(globalThis as any).__watchExpLeak }
        })
    }

    test("Exp watcher variants watch an expression and react to store changes", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#btn-show").click()
        await expect(page.locator("#watch-exp-panel")).toHaveText("Watch exp panel")

        await expect
            .poll(() => readLeak(page))
            .toEqual({
                watchExp: 0,
                preWatchExp: 0,
                postWatchExp: 0,
                syncWatchExp: 0
            })

        await page.locator("#btn-inc").click()
        await expect(page.locator("#store-count")).toHaveText("Store count: 1")

        await expect
            .poll(() => readLeak(page))
            .toEqual({
                watchExp: 1,
                preWatchExp: 1,
                postWatchExp: 1,
                syncWatchExp: 1
            })
    })

    test("Exp watcher variants are disposed when the component unmounts", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#btn-show").click()
        await expect(page.locator("#watch-exp-panel")).toHaveText("Watch exp panel")

        await page.locator("#btn-inc").click()
        await expect(page.locator("#store-count")).toHaveText("Store count: 1")
        await expect
            .poll(() => readLeak(page))
            .toEqual({
                watchExp: 1,
                preWatchExp: 1,
                postWatchExp: 1,
                syncWatchExp: 1
            })

        await page.locator("#btn-hide").click()
        await expect(page.locator("#watch-exp-panel")).toHaveCount(0)

        const beforeUnmount = await readLeak(page)

        await page.locator("#btn-inc").click()
        await expect(page.locator("#store-count")).toHaveText("Store count: 2")

        // Disposed Exp watchers must not re-fire.
        await expect.poll(() => readLeak(page)).toEqual(beforeUnmount)
    })
})
