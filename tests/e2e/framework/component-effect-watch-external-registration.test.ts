import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import ExternalPanel from "./components/ExternalPanel"
            import { store } from "./modules/effect-registry.js"

            let showPanel = false

            const showPanelFn = () => {
                showPanel = true
            }

            const hidePanelFn = () => {
                showPanel = false
            }
        </lang-js>

        <section data-page="component-effect-watch-external-registration">
            <div>
                <button id="btn-show" @click={showPanelFn}>Show panel</button>
                <button id="btn-hide" @click={hidePanelFn}>Hide panel</button>
                <button id="btn-inc" @click={store.count++}>Increment store</button>
            </div>

            <p id="store-count">Store count: {store.count}</p>
            <p id="effect-runs">Effect runs: {store.effectRuns}</p>
            <p id="watch-runs">Watch runs: {store.watchRuns}</p>

            <ExternalPanel #if={showPanel} />
        </section>
    `,
    components: {
        ExternalPanel: `
            <lang-js>
                import { store, registerEffect, registerWatch } from "../modules/effect-registry.js"

                registerEffect(effect, () => {
                    store.count
                    store.effectRuns++
                })

                registerWatch(watch, () => store.count, () => {
                    store.watchRuns++
                })
            </lang-js>

            <article id="external-panel">External registration panel</article>
        `
    },
    modules: {
        "effect-registry": `
            import { createStore } from "qingkuai"

            export const store = createStore({
                count: 0,
                effectRuns: 0,
                watchRuns: 0
            })

            export function registerEffect(effect, callback) {
                effect(callback)
            }

            export function registerWatch(watch, getter, callback) {
                watch(getter, callback)
            }
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("effect passed to an external module is usable", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#btn-show").click()
        await expect(page.locator("#external-panel")).toBeVisible()
        await expect(page.locator("#effect-runs")).toHaveText("Effect runs: 1")

        // Still alive while mounted: responds to store changes.
        await page.locator("#btn-inc").click()
        await expect(page.locator("#store-count")).toHaveText("Store count: 1")
        await expect(page.locator("#effect-runs")).toHaveText("Effect runs: 2")
    })

    test("externally-registered effect stops when the component is destroyed", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#btn-show").click()
        await expect(page.locator("#external-panel")).toBeVisible()

        await page.locator("#btn-inc").click()
        await expect(page.locator("#effect-runs")).toHaveText("Effect runs: 2")

        await page.locator("#btn-hide").click()
        await expect(page.locator("#external-panel")).toHaveCount(0)

        // Disposed effect must not run again when the store changes.
        await page.locator("#btn-inc").click()
        await expect(page.locator("#store-count")).toHaveText("Store count: 2")
        await expect(page.locator("#effect-runs")).toHaveText("Effect runs: 2")
    })

    test("externally-registered watch stops when the component is destroyed", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#btn-show").click()
        await expect(page.locator("#external-panel")).toBeVisible()

        // Watchers wait for the first change.
        await expect(page.locator("#watch-runs")).toHaveText("Watch runs: 0")

        await page.locator("#btn-inc").click()
        await expect(page.locator("#watch-runs")).toHaveText("Watch runs: 1")

        await page.locator("#btn-hide").click()
        await expect(page.locator("#external-panel")).toHaveCount(0)

        // Disposed watch must not fire again when the store changes.
        await page.locator("#btn-inc").click()
        await expect(page.locator("#store-count")).toHaveText("Store count: 2")
        await expect(page.locator("#watch-runs")).toHaveText("Watch runs: 1")
    })
})
