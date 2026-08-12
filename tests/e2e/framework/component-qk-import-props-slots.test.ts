import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import Panel from "./components/Panel.qk"
            import SyncPanel from "./components/SyncPanel.qk"

            let title = "Hello"
            let total = 0
            let panelHandle = null

            const handleNotify = payload => {
                total += payload.amount
            }
        </lang-js>

        <section data-page="component-qk-import-props-slots">
            <h1 id="title">QK Import Props Slots Events</h1>
            <p id="total">Total: {total}</p>
            <p id="handle-count">Handle: {panelHandle ? panelHandle.count : "null"}</p>
            <button id="btn-bump" @click={() => panelHandle?.bump()}>Bump via handle</button>

            <Panel !title={title} @notify={handleNotify} &handle={panelHandle}>
                <span id="slot-header" #slot={slotCtx from "header"}>{slotCtx.label}</span>
                <p id="slot-default">Default slot body</p>
            </Panel>
            <SyncPanel />
        </section>
    `,
    components: {
        Panel: `
            <lang-js>
                export let count = reactive(0)

                const notifyParent = () => {
                    props.notify({ amount: props.title.length })
                }

                const bump = () => {
                    count++
                }

                export { bump }
            </lang-js>

            <article id="panel">
                <header><slot name="header" !label={"from-child"} /></header>
                <p class="panel-title">Title: {props.title}</p>
                <slot></slot>
                <p class="panel-count">Count: {count}</p>
                <button class="panel-notify" @click={notifyParent}>Notify</button>
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
    test(".qk components receive props, slots, events and bind handle", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await expect(page).toHaveTitle("component-qk-import-props-slots")

        // props + slots（命名/默认）+ 同步组件共存
        // props + slots (named/default) + sync component coexist
        await expect(page.locator(".panel-title")).toHaveText("Title: Hello")
        await expect(page.locator("#slot-header")).toHaveText("from-child")
        await expect(page.locator("#slot-default")).toHaveText("Default slot body")
        await expect(page.locator("#sync-panel")).toHaveText("Sync Panel")
        await expect(page.locator("#handle-count")).toHaveText("Handle: 0")

        // 组件事件回调 → 父 total 更新（"Hello".length = 5）
        // Component event callback → parent total update ("Hello".length = 5)
        await page.locator(".panel-notify").click()
        await expect(page.locator("#total")).toHaveText("Total: 5")

        // &handle 调用 .qk 组件导出方法
        // &handle calls the exported method of the .qk component
        await page.locator("#btn-bump").click()
        await expect(page.locator(".panel-count")).toHaveText("Count: 1")
        await expect(page.locator("#handle-count")).toHaveText("Handle: 1")
    })
})
