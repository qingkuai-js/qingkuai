import type { E2EPageEvaluator, E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import RefsOnlyPanel from "./components/defaults/RefsOnlyPanel"
            import NoCheckPanel from "./components/defaults/NoCheckPanel"

            globalThis.__defaultsEdgeLeak = { effectRuns: 0, effectCleanups: 0 }

            let showPanel = false

            const showPanelFn = () => {
                showPanel = true
            }

            const hidePanelFn = () => {
                showPanel = false
            }
        </lang-js>

        <section data-page="component-defaults-edge-cases">
            <h1 id="defaults-edge-title">Defaults Edge Cases</h1>

            <RefsOnlyPanel />

            <div>
                <button id="btn-show" @click={showPanelFn}>Show panel</button>
                <button id="btn-hide" @click={hidePanelFn}>Hide panel</button>
            </div>

            <NoCheckPanel #if={showPanel} />
        </section>
    `,
    components: {
        "defaults/RefsOnlyPanel": `
            <lang-js>
                defaults({
                    refs: {
                        seed: 10,
                        tag: "default-tag"
                    }
                })

                const bumpSeed = () => {
                    refs.seed++
                }
            </lang-js>

            <article class="refs-only-panel">
                <p class="panel-seed">Seed: {refs.seed}</p>
                <p class="panel-tag">Tag: {refs.tag}</p>
                <button class="panel-bump" @click={bumpSeed}>Bump seed</button>
            </article>
        `,
        "defaults/NoCheckPanel": `
            <lang-js>
                defaults({
                    props: {
                        mode: "normal"
                    }
                })

                effect(() => {
                    props.mode
                    globalThis.__defaultsEdgeLeak.effectRuns++
                    return () => {
                        globalThis.__defaultsEdgeLeak.effectCleanups++
                    }
                })
            </lang-js>

            <article id="no-check-panel">NoCheck panel</article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    const readLeak = (page: E2EPageEvaluator) => {
        return page.evaluate(() => {
            return { ...(globalThis as any).__defaultsEdgeLeak }
        })
    }

    test("refs-only defaults render and stay writable without props", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const panel = page.locator(".refs-only-panel")
        await expect(panel.locator(".panel-seed")).toHaveText("Seed: 10")
        await expect(panel.locator(".panel-tag")).toHaveText("Tag: default-tag")

        await panel.locator(".panel-bump").click()
        await expect(panel.locator(".panel-seed")).toHaveText("Seed: 11")
        await expect(panel.locator(".panel-tag")).toHaveText("Tag: default-tag")
    })

    test("effect reading a props default is kept alive and cleaned up on unmount", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#no-check-panel")).toHaveCount(0)

        await page.locator("#btn-show").click()
        await expect(page.locator("#no-check-panel")).toHaveText("NoCheck panel")
        await expect.poll(() => readLeak(page)).toEqual({ effectRuns: 1, effectCleanups: 0 })

        // Effect only reads non-reactive props, yet markActiveEffectNoCheck keeps
        // it registered in the destruction chain, so its cleanup must run on unmount.
        await page.locator("#btn-hide").click()
        await expect(page.locator("#no-check-panel")).toHaveCount(0)
        await expect.poll(() => readLeak(page)).toEqual({ effectRuns: 1, effectCleanups: 1 })

        // Re-mounting creates a fresh instance; the cycle repeats.
        await page.locator("#btn-show").click()
        await expect(page.locator("#no-check-panel")).toHaveText("NoCheck panel")
        await expect.poll(() => readLeak(page)).toEqual({ effectRuns: 2, effectCleanups: 1 })

        await page.locator("#btn-hide").click()
        await expect(page.locator("#no-check-panel")).toHaveCount(0)
        await expect.poll(() => readLeak(page)).toEqual({ effectRuns: 2, effectCleanups: 2 })
    })
})
