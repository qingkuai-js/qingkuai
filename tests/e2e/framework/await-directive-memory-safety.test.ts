import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let resolverFunc = null
            let memoryPromise = new Promise(resolve => {
                resolverFunc = resolve
            })

            let resolveCount = 0

            const triggerResolve = () => {
                if (resolverFunc) {
                    resolverFunc("resolved value")
                    resolveCount++
                }
            }

            const resetMemoryPromise = () => {
                resolveCount = 0
                resolverFunc = null
                memoryPromise = new Promise(resolve => {
                    resolverFunc = resolve
                })
            }

            const triggerResolveMultipleTimes = () => {
                triggerResolve()
                triggerResolve()
                triggerResolve()
            }
        </lang-js>

        <section data-page="await-directive-memory-safety">
            <div>
                <button id="trigger-resolve" @click={triggerResolve()}>Resolve Once</button>
                <button id="trigger-multiple" @click={triggerResolveMultipleTimes()}>
                    Resolve 3x
                </button>
                <button id="reset-memory" @click={resetMemoryPromise()}>Reset</button>
            </div>

            <div id="memory-container">
                <p id="memory-pending" #await={memoryPromise}>
                    Memory test pending...
                </p>
                <p id="memory-resolved" #then={val}>
                    Resolved: {val}
                </p>
                <p id="memory-error" #catch={err}>{err}</p>
            </div>

            <p id="resolve-count">Resolve count: {resolveCount}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("prevents duplicate callback invocations on repeated resolve", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#memory-pending")).toHaveText("Memory test pending...")
        await expect(page.locator("#memory-resolved")).toHaveCount(0)

        await page.locator("#trigger-resolve").click()
        await expect(page.locator("#memory-resolved")).toHaveText("Resolved: resolved value")
        await expect(page.locator("#memory-pending")).toHaveCount(0)
        await expect(page.locator("#resolve-count")).toHaveText("Resolve count: 1")

        await page.locator("#reset-memory").click()
        await expect(page.locator("#memory-pending")).toHaveText("Memory test pending...")
        await expect(page.locator("#memory-resolved")).toHaveCount(0)

        await page.locator("#trigger-multiple").click()
        await expect(page.locator("#memory-resolved")).toHaveText("Resolved: resolved value")
        await expect(page.locator("#resolve-count")).toHaveText("Resolve count: 3")
    })
})
