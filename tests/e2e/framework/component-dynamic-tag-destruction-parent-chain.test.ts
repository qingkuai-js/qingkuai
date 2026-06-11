import type { E2EPageEvaluator, E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import PanelOne from "./components/PanelOne"
            import PanelTwo from "./components/PanelTwo"

            let showHost = true
            let sequence = 0
            let CurrentPanel = PanelOne

            globalThis.__dynamicTagDestructionParentChainLog = []

            const appendLog = label => {
                globalThis.__dynamicTagDestructionParentChainLog.push(label)
            }

            const switchPanel = () => {
                sequence++
                CurrentPanel = CurrentPanel === PanelOne ? PanelTwo : PanelOne
            }

            const hideHost = () => {
                showHost = false
            }

            const showHostAgain = () => {
                showHost = true
            }
        </lang-js>

        <section data-page="component-dynamic-tag-destruction-parent-chain">
            <button id="btn-switch" @click={switchPanel}>Switch panel</button>
            <button id="btn-hide-host" @click={hideHost}>Hide host</button>
            <button id="btn-show-host" @click={showHostAgain}>Show host</button>

            <div id="dynamic-host" #if={showHost}>
                <CurrentPanel @log={appendLog} !id={sequence} />
            </div>
            <p id="dynamic-host-hidden" #else>Host hidden</p>
        </section>
    `,
    components: {
        PanelOne: `
            <lang-js>
                import { onAfterMount, onBeforeDestroy, onAfterDestroy } from "qingkuai"

                onAfterMount(() => {
                    props.log("panel-one-mount-" + props.id)
                })

                onBeforeDestroy(() => {
                    props.log("panel-one-before-destroy-" + props.id)
                })

                onAfterDestroy(() => {
                    props.log("panel-one-after-destroy-" + props.id)
                })
            </lang-js>

            <article id="panel-one">Panel one: {props.id}</article>
        `,
        PanelTwo: `
            <lang-js>
                import { onAfterMount, onBeforeDestroy, onAfterDestroy } from "qingkuai"

                onAfterMount(() => {
                    props.log("panel-two-mount-" + props.id)
                })

                onBeforeDestroy(() => {
                    props.log("panel-two-before-destroy-" + props.id)
                })

                onAfterDestroy(() => {
                    props.log("panel-two-after-destroy-" + props.id)
                })
            </lang-js>

            <article id="panel-two">Panel two: {props.id}</article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    const readLog = (page: E2EPageEvaluator) => {
        return page.evaluate(() => {
            return ((globalThis as any).__dynamicTagDestructionParentChainLog as string[]).slice()
        })
    }

    test("dynamic tag switch destroys previous component", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#panel-one")).toHaveText("Panel one: 0")

        await page.locator("#btn-switch").click()
        await expect(page.locator("#panel-two")).toHaveText("Panel two: 1")

        await expect
            .poll(() => readLog(page))
            .toEqual([
                "panel-one-mount-0",
                "panel-one-before-destroy-1",
                "panel-one-after-destroy-1",
                "panel-two-mount-1"
            ])
    })

    test("parent unmount destroys current dynamic component", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#btn-switch").click()
        await expect(page.locator("#panel-two")).toHaveText("Panel two: 1")

        await page.locator("#btn-hide-host").click()
        await expect(page.locator("#dynamic-host-hidden")).toHaveText("Host hidden")
        await expect(page.locator("#panel-two")).toHaveCount(0)

        await expect
            .poll(() => readLog(page))
            .toEqual([
                "panel-one-mount-0",
                "panel-one-before-destroy-1",
                "panel-one-after-destroy-1",
                "panel-two-mount-1",
                "panel-two-before-destroy-1",
                "panel-two-after-destroy-1"
            ])
    })
})
