import type { E2EPageEvaluator, E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import TargetPanel from "./components/TargetPanel"

            let showHost = true
            let targetSelector = null
            let sequence = 0

            globalThis.__targetDestructionParentChainLog = []

            const appendLog = label => {
                globalThis.__targetDestructionParentChainLog.push(label)
            }

            const bump = () => {
                sequence++
            }

            const hideHost = () => {
                showHost = false
            }

            const showHostAgain = () => {
                showHost = true
            }

            const resetInline = () => {
                targetSelector = null
            }

            const teleport = () => {
                targetSelector = "#target-dest"
            }
        </lang-js>

        <section data-page="target-directive-destruction-parent-chain">
            <button id="btn-bump" @click={bump}>Bump</button>
            <button id="btn-hide-host" @click={hideHost}>Hide host</button>
            <button id="btn-show-host" @click={showHostAgain}>Show host</button>
            <button id="btn-reset-inline" @click={resetInline}>Reset inline</button>
            <button id="btn-teleport" @click={teleport}>Teleport</button>

            <div id="target-host" #if={showHost}>
                <div id="target-source" #target={targetSelector}>
                    <TargetPanel @log={appendLog} !id={sequence} />
                </div>
            </div>
            <p id="target-host-hidden" #else>Host hidden</p>

            <div id="target-dest"></div>
        </section>
    `,
    components: {
        TargetPanel: `
            <lang-js>
                import { onAfterMount, onBeforeDestroy, onAfterDestroy } from "qingkuai"

                onAfterMount(() => {
                    props.log("target-mount-" + props.id)
                })

                onBeforeDestroy(() => {
                    props.log("target-before-destroy-" + props.id)
                })

                onAfterDestroy(() => {
                    props.log("target-after-destroy-" + props.id)
                })
            </lang-js>

            <article id="target-panel">Target panel: {props.id}</article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    const readLog = (page: E2EPageEvaluator) => {
        return page.evaluate(() => {
            return ((globalThis as any).__targetDestructionParentChainLog as string[]).slice()
        })
    }

    test("target block keeps component mounted while teleporting", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#target-source #target-panel")).toHaveText("Target panel: 0")

        await page.locator("#btn-bump").click()
        await expect(page.locator("#target-source #target-panel")).toHaveText("Target panel: 1")

        await page.locator("#btn-teleport").click()
        await expect(page.locator("#target-dest #target-panel")).toHaveText("Target panel: 1")

        await page.locator("#btn-reset-inline").click()
        await expect(page.locator("#target-source #target-panel")).toHaveText("Target panel: 1")

        await expect.poll(() => readLog(page)).toEqual(["target-mount-0"])
    })

    test("parent unmount destroys component inside target block", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#btn-teleport").click()
        await expect(page.locator("#target-dest #target-panel")).toHaveText("Target panel: 0")

        await page.locator("#btn-hide-host").click()
        await expect(page.locator("#target-host-hidden")).toHaveText("Host hidden")
        await expect(page.locator("#target-panel")).toHaveCount(0)

        await expect
            .poll(() => readLog(page))
            .toEqual(["target-mount-0", "target-before-destroy-0", "target-after-destroy-0"])
    })
})
