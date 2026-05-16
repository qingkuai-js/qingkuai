import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import CounterExportPanel from "./components/export/CounterExportPanel"

            let panel = null
            let visible = true
            let snapshot = "none"

            const callIncrease = () => {
                if (!panel) {
                    snapshot = "null-handle"
                    return
                }
                panel.increase()
                snapshot = String(panel.count)
            }

            const callReset = () => {
                if (!panel) {
                    snapshot = "null-handle"
                    return
                }
                panel.reset()
                snapshot = String(panel.count)
            }

            const readCount = () => {
                snapshot = panel ? String(panel.count) : "null-handle"
            }

            const toggleVisible = () => {
                visible = !visible
            }
        </lang-js>

        <section data-page="component-export-handle">
            <p id="handle-state">Handle: {panel ? "ready" : "null"}</p>
            <p id="snapshot">Snapshot: {snapshot}</p>

            <button id="btn-increase" @click={callIncrease}>Increase via handle</button>
            <button id="btn-reset" @click={callReset}>Reset via handle</button>
            <button id="btn-read" @click={readCount}>Read via handle</button>
            <button id="btn-toggle" @click={toggleVisible}>Toggle child</button>

            <qk:spread #if={visible}>
                <CounterExportPanel &handle={panel} />
            </qk:spread>
        </section>
    `,
    components: {
        "export/CounterExportPanel": `
            <lang-js>
                export let count = reactive(0)

                function increase() {
                    count++
                }

                function reset() {
                    count = 0
                }

                export { increase, reset }
            </lang-js>

            <article id="counter-export-panel">
                <p id="child-count">Child count: {count}</p>
                <button id="child-increase" @click={increase}>Increase inside child</button>
            </article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports invoking exported child API via parent handle", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#child-count")).toHaveText("Child count: 0")
        await expect(page.locator("#snapshot")).toHaveText("Snapshot: none")

        await page.locator("#btn-increase").click()
        await expect(page.locator("#child-count")).toHaveText("Child count: 1")
        await expect(page.locator("#snapshot")).toHaveText("Snapshot: 1")

        await page.locator("#btn-increase").click()
        await expect(page.locator("#child-count")).toHaveText("Child count: 2")
        await expect(page.locator("#snapshot")).toHaveText("Snapshot: 2")

        await page.locator("#btn-reset").click()
        await expect(page.locator("#child-count")).toHaveText("Child count: 0")
        await expect(page.locator("#snapshot")).toHaveText("Snapshot: 0")

        await page.locator("#child-increase").click()
        await page.locator("#btn-read").click()
        await expect(page.locator("#snapshot")).toHaveText("Snapshot: 1")
    })

    test("clears handle on unmount and restores exported API after remount", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#btn-toggle").click()
        await expect(page.locator("#counter-export-panel")).toHaveCount(0)

        await page.locator("#btn-increase").click()
        await expect(page.locator("#snapshot")).toHaveText("Snapshot: null-handle")

        await page.locator("#btn-toggle").click()
        await expect(page.locator("#counter-export-panel")).toBeVisible()
        await expect(page.locator("#child-count")).toHaveText("Child count: 0")

        await page.locator("#btn-increase").click()
        await expect(page.locator("#child-count")).toHaveText("Child count: 1")
        await expect(page.locator("#snapshot")).toHaveText("Snapshot: 1")
    })
})
