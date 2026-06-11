import type { E2EPageEvaluator, E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import BranchPanel from "./components/BranchPanel"

            let showHost = true
            let showBranch = false
            let sequence = 0

            globalThis.__ifDestructionParentChainLog = []

            const appendLog = label => {
                globalThis.__ifDestructionParentChainLog.push(label)
            }

            const showBranchPanel = () => {
                sequence++
                showBranch = true
            }

            const hideBranchPanel = () => {
                showBranch = false
            }

            const hideHost = () => {
                showHost = false
            }

            const showHostAgain = () => {
                showHost = true
            }
        </lang-js>

        <section data-page="if-directive-destruction-parent-chain">
            <div>
                <button id="btn-show-branch" @click={showBranchPanel}>Show branch</button>
                <button id="btn-hide-branch" @click={hideBranchPanel}>Hide branch</button>
                <button id="btn-hide-host" @click={hideHost}>Hide host</button>
                <button id="btn-show-host" @click={showHostAgain}>Show host</button>
            </div>

            <div id="if-host" #if={showHost}>
                <BranchPanel #if={showBranch} @log={appendLog} !id={sequence} />
                <p id="branch-fallback" #else>Branch fallback</p>
            </div>
            <p id="if-host-hidden" #else>Host hidden</p>
        </section>
    `,
    components: {
        BranchPanel: `
            <lang-js>
                import { onAfterMount, onBeforeDestroy, onAfterDestroy } from "qingkuai"

                onAfterMount(() => {
                    props.log("if-mount-" + props.id)
                })

                onBeforeDestroy(() => {
                    props.log("if-before-destroy-" + props.id)
                })

                onAfterDestroy(() => {
                    props.log("if-after-destroy-" + props.id)
                })
            </lang-js>

            <article id="if-branch-panel">Branch id: {props.id}</article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    const readLog = (page: E2EPageEvaluator) => {
        return page.evaluate(() => {
            return ((globalThis as any).__ifDestructionParentChainLog as string[]).slice()
        })
    }

    test("if branch mounts and unmounts in normal path", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#branch-fallback")).toHaveText("Branch fallback")

        await page.locator("#btn-show-branch").click()
        await expect(page.locator("#if-branch-panel")).toHaveText("Branch id: 1")

        await page.locator("#btn-hide-branch").click()
        await expect(page.locator("#branch-fallback")).toHaveText("Branch fallback")

        await expect
            .poll(() => readLog(page))
            .toEqual(["if-mount-1", "if-before-destroy-1", "if-after-destroy-1"])
    })

    test("parent unmount destroys component mounted by if reinvocation", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#btn-show-branch").click()
        await expect(page.locator("#if-branch-panel")).toHaveText("Branch id: 1")

        await page.locator("#btn-hide-host").click()
        await expect(page.locator("#if-host-hidden")).toHaveText("Host hidden")
        await expect(page.locator("#if-branch-panel")).toHaveCount(0)

        await expect
            .poll(() => readLog(page))
            .toEqual(["if-mount-1", "if-before-destroy-1", "if-after-destroy-1"])
    })
})
