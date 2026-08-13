import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import SyncPanel from "./components/SyncEffectWatchPanel"
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

        <section data-page="component-effect-watch-destruction">
            <div>
                <button id="btn-show" @click={showPanelFn}>Show panel</button>
                <button id="btn-hide" @click={hidePanelFn}>Hide panel</button>
                <button id="btn-inc" @click={store.count++}>Increment store</button>
            </div>

            <p id="store-count">Store count: {store.count}</p>
            <p id="sync-leak">
                effect:{store.effect},preEffect:{store.preEffect},postEffect:{store.postEffect},syncEffect:{store.syncEffect},watch:{store.watch},preWatch:{store.preWatch},postWatch:{store.postWatch},syncWatch:{store.syncWatch}
            </p>
            <p id="store-double">Store double: {store.double}</p>
            <p id="store-watch">Store watch: {store.lastWatch}</p>

            <SyncPanel #if={showPanel} />
            <ExternalPanel #if={showPanel} />
        </section>
    `,
    components: {
        SyncEffectWatchPanel: `
            <lang-js>
                import { store } from "../modules/effect-registry.js"

                effect(() => {
                    store.effect++
                    store.count
                })
                preEffect(() => {
                    store.preEffect++
                    store.count
                })
                postEffect(() => {
                    store.postEffect++
                    store.count
                })
                syncEffect(() => {
                    store.syncEffect++
                    store.count
                })
                watch(() => store.count, () => {
                    store.watch++
                })
                preWatch(() => store.count, () => {
                    store.preWatch++
                })
                postWatch(() => store.count, () => {
                    store.postWatch++
                })
                syncWatch(() => store.count, () => {
                    store.syncWatch++
                })
            </lang-js>

            <article id="sync-panel">Sync effect watch panel</article>
        `,
        ExternalPanel: `
            <lang-js>
                import { store, registerEffect, registerWatch } from "../modules/effect-registry.js"

                registerEffect(effect, () => {
                    store.double = store.count * 2
                })

                registerWatch(watch, () => store.count, (pre, cur) => {
                    store.lastWatch = pre + "->" + cur
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
                double: 0,
                lastWatch: "",
                effect: 0,
                preEffect: 0,
                postEffect: 0,
                syncEffect: 0,
                watch: 0,
                preWatch: 0,
                postWatch: 0,
                syncWatch: 0
            })

            export function registerEffect(effect, fn) {
                effect(fn)
            }

            export function registerWatch(watch, getter, onUpdate) {
                watch(getter, onUpdate)
            }
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("all effect/watch timing variants are disposed when the component unmounts", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#btn-show").click()
        await expect(page.locator("#sync-panel")).toHaveText("Sync effect watch panel")

        // Establish a baseline where every variant fired once after a change.
        await page.locator("#btn-inc").click()
        await expect(page.locator("#store-count")).toHaveText("Store count: 1")
        await expect(page.locator("#sync-leak")).toHaveText(
            "effect:2,preEffect:2,postEffect:2,syncEffect:2,watch:1,preWatch:1,postWatch:1,syncWatch:1"
        )

        await page.locator("#btn-hide").click()
        await expect(page.locator("#sync-panel")).toHaveCount(0)

        const beforeUnmount = await page.locator("#sync-leak").innerText()

        await page.locator("#btn-inc").click()
        await expect(page.locator("#store-count")).toHaveText("Store count: 2")

        // Disposed effect/watch must not re-fire.
        await expect(page.locator("#sync-leak")).toHaveText(beforeUnmount)
    })

    test("external module registrations drive an imported store while mounted", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#btn-show").click()
        await expect(page.locator("#external-panel")).toBeVisible()

        await expect(page.locator("#store-double")).toHaveText("Store double: 0")
        await expect(page.locator("#store-watch")).toHaveText("Store watch: ")

        await page.locator("#btn-inc").click()
        await expect(page.locator("#store-count")).toHaveText("Store count: 1")
        await expect(page.locator("#store-double")).toHaveText("Store double: 2")
        await expect(page.locator("#store-watch")).toHaveText("Store watch: 0->1")
    })

    test("external module registrations are disposed when the component unmounts", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#btn-show").click()
        await expect(page.locator("#external-panel")).toBeVisible()

        await page.locator("#btn-inc").click()
        await expect(page.locator("#store-count")).toHaveText("Store count: 1")
        await expect(page.locator("#store-double")).toHaveText("Store double: 2")
        await expect(page.locator("#store-watch")).toHaveText("Store watch: 0->1")

        await page.locator("#btn-hide").click()
        await expect(page.locator("#external-panel")).toHaveCount(0)

        // Destroying the component disposes the registered effect/watch; the
        // derived store values must stay frozen when the store changes again.
        await page.locator("#btn-inc").click()
        await expect(page.locator("#store-count")).toHaveText("Store count: 2")
        await expect(page.locator("#store-double")).toHaveText("Store double: 2")
        await expect(page.locator("#store-watch")).toHaveText("Store watch: 0->1")
    })
})
