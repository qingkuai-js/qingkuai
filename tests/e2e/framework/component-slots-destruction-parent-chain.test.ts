import type { E2EPageEvaluator, E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import SlotHost from "./components/SlotHost"
            import SlotPanel from "./components/SlotPanel"

            let showHost = true
            let sequence = 0

            globalThis.__slotDestructionParentChainLog = []

            const appendLog = label => {
                globalThis.__slotDestructionParentChainLog.push(label)
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
        </lang-js>

        <section data-page="component-slots-destruction-parent-chain">
            <button id="btn-bump" @click={bump}>Bump</button>
            <button id="btn-hide-host" @click={hideHost}>Hide host</button>
            <button id="btn-show-host" @click={showHostAgain}>Show host</button>

            <SlotHost #if={showHost}>
                <qk:spread>
                    <SlotPanel @log={appendLog} !id={sequence} />
                </qk:spread>
            </SlotHost>
            <p id="slot-host-hidden" #else>Host hidden</p>
        </section>
    `,
    components: {
        SlotHost: `
            <div id="slot-host"><slot></slot></div>
        `,
        SlotPanel: `
            <lang-js>
                import { onAfterMount, onBeforeDestroy, onAfterDestroy } from "qingkuai"

                onAfterMount(() => {
                    props.log("slot-mount-" + props.id)
                })

                onBeforeDestroy(() => {
                    props.log("slot-before-destroy-" + props.id)
                })

                onAfterDestroy(() => {
                    props.log("slot-after-destroy-" + props.id)
                })
            </lang-js>

            <article id="slot-panel">Slot panel: {props.id}</article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    const readLog = (page: E2EPageEvaluator) => {
        return page.evaluate(() => {
            return ((globalThis as any).__slotDestructionParentChainLog as string[]).slice()
        })
    }

    test("slot content component stays mounted across parent updates", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#slot-panel")).toHaveText("Slot panel: 0")

        await page.locator("#btn-bump").click()
        await expect(page.locator("#slot-panel")).toHaveText("Slot panel: 1")

        await expect.poll(() => readLog(page)).toEqual(["slot-mount-0"])
    })

    test("parent unmount destroys slot-rendered component", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#slot-panel")).toHaveText("Slot panel: 0")

        await page.locator("#btn-hide-host").click()
        await expect(page.locator("#slot-host-hidden")).toHaveText("Host hidden")
        await expect(page.locator("#slot-panel")).toHaveCount(0)

        await expect
            .poll(() => readLog(page))
            .toEqual(["slot-mount-0", "slot-before-destroy-0", "slot-after-destroy-0"])
    })
})
