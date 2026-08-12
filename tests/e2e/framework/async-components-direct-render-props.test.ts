import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let AsyncView = import("./components/AsyncCard")

            let title = "Hello"
            let step = 1
            let total = 0
            let cardHandle = null

            const handleSaved = payload => {
                total += payload.step
            }

            const bumpViaHandle = () => {
                if (cardHandle) {
                    cardHandle.bump()
                }
            }
        </lang-js>

        <section data-page="async-components-direct-render-props">
            <h1 id="title">Async Direct Render With Props</h1>
            <p id="total">Total: {total}</p>
            <p id="handle-count">Handle: {cardHandle ? cardHandle.count : "null"}</p>
            <button id="btn-bump" @click={bumpViaHandle}>Bump via handle</button>

            <AsyncView !title={title} !step={step} @saved={handleSaved} &handle={cardHandle} />
        </section>
    `,
    components: {
        AsyncCard: `
            <lang-js>
                export let count = reactive(0)

                const emitSaved = () => {
                    props.saved({ step: props.step })
                }

                const bump = () => {
                    count++
                }

                export { bump }
            </lang-js>

            <article id="async-card">
                <p class="card-title">Title: {props.title}</p>
                <p class="card-count">Count: {count}</p>
                <button class="card-emit" @click={emitSaved}>Emit saved</button>
            </article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("async component receives props, emits events and binds handle", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await expect(page.locator(".card-title")).toHaveText("Title: Hello")
        await expect(page.locator(".card-count")).toHaveText("Count: 0")
        await expect(page.locator("#handle-count")).toHaveText("Handle: 0")

        // 组件内触发事件回调 → 父 total 更新
        // Trigger event callback inside the component → parent total updates
        await page.locator(".card-emit").click()
        await expect(page.locator("#total")).toHaveText("Total: 1")

        // 通过 &handle 调用组件导出方法
        // Call component exported method via &handle
        await page.locator("#btn-bump").click()
        await expect(page.locator(".card-count")).toHaveText("Count: 1")
        await expect(page.locator("#handle-count")).toHaveText("Handle: 1")
    })
})
