import type { E2EPageEvaluator, E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import ThenPanel from "./components/ThenPanel"

            const createPendingPromise = () => new Promise(() => {})

            let sequence = 0
            let showHost = true
            let branchPromise = createPendingPromise()

            globalThis.__awaitDestructionParentChainLog = []

            const resolveBranch = () => {
                sequence++
                branchPromise = new Promise(resolve => {
                    setTimeout(() => resolve("ok-" + sequence), 10)
                })
            }

            const resetBranch = () => {
                branchPromise = createPendingPromise()
            }

            const hideHost = () => {
                showHost = false
            }

            const showHostAgain = () => {
                showHost = true
            }

            const clearLog = () => {
                globalThis.__awaitDestructionParentChainLog = []
            }

            const appendLog = label => {
                globalThis.__awaitDestructionParentChainLog.push(label)
            }
        </lang-js>

        <section data-page="await-directive-destruction-parent-chain">
            <div>
                <button id="btn-resolve" @click={resolveBranch}>Resolve</button>
                <button id="btn-reset" @click={resetBranch}>Reset</button>
                <button id="btn-hide" @click={hideHost}>Hide host</button>
                <button id="btn-show" @click={showHostAgain}>Show host</button>
                <button id="btn-clear-log" @click={clearLog}>Clear log</button>
            </div>

            <div id="await-host" #if={showHost}>
                <p id="await-pending" #await={branchPromise}>Pending...</p>
                <ThenPanel #then={value} @log={appendLog} !value={value} />
                <p id="await-catch" #catch={reason}>Catch: {reason}</p>
            </div>
            <p id="await-host-hidden" #else>Host hidden</p>
        </section>
    `,
    components: {
        ThenPanel: `
            <lang-js>
                import { onAfterMount, onBeforeDestroy, onAfterDestroy } from "qingkuai"

                onAfterMount(() => {
                    props.log("then-mount-" + props.value)
                })

                onBeforeDestroy(() => {
                    props.log("then-before-destroy-" + props.value)
                })

                onAfterDestroy(() => {
                    props.log("then-after-destroy-" + props.value)
                })
            </lang-js>

            <article id="then-panel">Then value: {props.value}</article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    const readLog = (page: E2EPageEvaluator) => {
        return page.evaluate(() => {
            return ((globalThis as any).__awaitDestructionParentChainLog as string[]).slice()
        })
    }

    test("await then branch mounts after promise resolve", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#await-pending")).toHaveText("Pending...")
        await expect(page.locator("#then-panel")).toHaveCount(0)

        await page.locator("#btn-resolve").click()
        await expect(page.locator("#then-panel")).toHaveText("Then value: ok-1")
        await expect.poll(() => readLog(page)).toEqual(["then-mount-ok-1"])
    })

    test("parent unmount destroys await then branch component", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#btn-resolve").click()
        await expect(page.locator("#then-panel")).toHaveText("Then value: ok-1")

        await page.locator("#btn-hide").click()
        await expect(page.locator("#await-host-hidden")).toHaveText("Host hidden")
        await expect(page.locator("#then-panel")).toHaveCount(0)

        await expect
            .poll(() => readLog(page))
            .toEqual(["then-mount-ok-1", "then-before-destroy-ok-1", "then-after-destroy-ok-1"])
    })
})
