import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            const AsyncView = import("./components/AsyncPanel")
            let target = null

            const moveToA = () => {
                target = "#dest-a"
            }

            const resetInline = () => {
                target = null
            }
        </lang-js>

        <section data-page="target-directive-async-component-tag">
            <h1 id="title">Async Component Tag With Target</h1>
            <button id="btn-to-a" @click={moveToA}>Move to A</button>
            <button id="btn-reset" @click={resetInline}>Reset inline</button>

            <div id="source">
                <AsyncView #target={target} />
            </div>
            <div id="dest-a"></div>
        </section>
    `,
    components: {
        AsyncPanel: `<article id="async-panel">Async Panel</article>`
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("async component tag renders and teleports to #target", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await expect(page.locator("#source #async-panel")).toHaveText("Async Panel")

        // 移到 #dest-a
        // Move to #dest-a
        await page.locator("#btn-to-a").click()
        await expect(page.locator("#dest-a #async-panel")).toHaveCount(1)
        await expect(page.locator("#source #async-panel")).toHaveCount(0)

        // 回到 inline
        // Back to inline
        await page.locator("#btn-reset").click()
        await expect(page.locator("#source #async-panel")).toHaveText("Async Panel")
        await expect(page.locator("#dest-a #async-panel")).toHaveCount(0)
    })
})
