import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let showPanel = true
            let probe = "idle"

            const AsyncComp = new Promise(resolve => {
                window.resolveAsyncComp = () => {
                    probe = "resolved"
                    resolve(import("./components/AsyncOne"))
                }
            })

            const unmountPanel = () => {
                showPanel = false
            }
        </lang-js>

        <section data-page="async-components-render-unmount">
            <h1 id="title">Async Components Render After Unmount</h1>
            <p id="probe">{probe}</p>
            <button id="unmount" @click={unmountPanel}>Unmount panel</button>
            <div id="panel-host" #if={showPanel}>
                <AsyncComp />
            </div>
        </section>
    `,
    components: {
        AsyncOne: `<article id="async-one">Async One</article>`
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("does not render an async component after its host panel is unmounted", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await expect(page).toHaveTitle("async-components-render-unmount")
        await expect(page.locator("#panel-host")).toHaveCount(1)
        await expect(page.locator("#async-one")).toHaveCount(0)

        // 卸载面板（异步组件所在的条件块销毁）
        // Unmount the panel (the conditional block containing the async component is destroyed)
        await page.locator("#unmount").click()
        await expect(page.locator("#panel-host")).toHaveCount(0)

        // 之后才 resolve：组件不应被渲染
        // Resolve afterwards: the component should not be rendered
        await page.evaluate(() => (globalThis as any).resolveAsyncComp())
        await expect(page.locator("#probe")).toHaveText("resolved")
        await expect(page.locator("#async-one")).toHaveCount(0)
    })
})
