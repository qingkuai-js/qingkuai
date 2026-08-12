import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import Counter from "./components/Counter.qk"
            import SyncPanel from "./components/SyncPanel.qk"

            let counterHandle = null
            let snapshot = "none"

            const readHandle = () => {
                snapshot = counterHandle ? String(counterHandle.count) : "null"
            }
        </lang-js>

        <section data-page="component-qk-import">
            <h1 id="title">QK Import Components</h1>
            <p id="snapshot">Snapshot: {snapshot}</p>
            <button id="btn-read" @click={readHandle}>Read handle</button>
            <Counter &handle={counterHandle} />
            <SyncPanel />
        </section>
    `,
    components: {
        Counter: `
            <lang-js>
                export let count = reactive(0)

                function increment() {
                    count++
                }

                export { increment }
            </lang-js>

            <article id="counter-panel">
                <p class="counter-value">Counter: {count}</p>
                <button class="counter-increment" @click={increment}>Increment</button>
            </article>
        `,
        SyncPanel: `
            <article id="sync-panel">Sync Panel</article>
        `
    },
    compileOptions: {
        replaceQkImports: true
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("renders and drives components imported from .qk modules", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await expect(page).toHaveTitle("component-qk-import")
        await expect(page.locator("#sync-panel")).toHaveText("Sync Panel")
        await expect(page.locator(".counter-value")).toHaveText("Counter: 0")

        // 组件内部交互（直接调用组件函数渲染，内部响应式应正常）
        // The internal state of the component should be updated correctly when the button is clicked.
        await page.locator(".counter-increment").click()
        await expect(page.locator(".counter-value")).toHaveText("Counter: 1")

        // &handle 绑定到 .qk 导入组件实例，读取导出 API
        // The `&handle` binding should be able to read the exported API of the .qk imported component instance.
        await page.locator("#btn-read").click()
        await expect(page.locator("#snapshot")).toHaveText("Snapshot: 1")
    })
})
