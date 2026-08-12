import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import SlotHost from "./components/SlotHost"

            let items = reactive([1, 2, 3])
            let showList = true

            const addItem = () => {
                items = [...items, items.length + 1]
            }

            const toggleList = () => {
                showList = !showList
            }
        </lang-js>

        <section data-page="component-slots-directive-combinators">
            <h1 id="title">Slots With Directives</h1>
            <button id="btn-add" @click={addItem}>Add item</button>
            <button id="btn-toggle" @click={toggleList}>Toggle list</button>

            <SlotHost>
                <ul id="slot-list" #if={showList}>
                    <li #for={item of items}>Item {item}</li>
                </ul>
            </SlotHost>
        </section>
    `,
    components: {
        SlotHost: `
            <article id="slot-host">
                <slot></slot>
            </article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("slot content supports #for and #if with reactive updates", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await expect(page.locator("#slot-list li")).toHaveCount(3)
        await expect(page.locator("#slot-list li").nth(2)).toHaveText("Item 3")

        // 新增条目 → 列表更新
        // Add new item → list update
        await page.locator("#btn-add").click()
        await expect(page.locator("#slot-list li")).toHaveCount(4)
        await expect(page.locator("#slot-list li").nth(3)).toHaveText("Item 4")

        // 隐藏列表 → 移除
        // Hide list → remove
        await page.locator("#btn-toggle").click()
        await expect(page.locator("#slot-list")).toHaveCount(0)

        // 再次显示 → 恢复
        // Show again → restore
        await page.locator("#btn-toggle").click()
        await expect(page.locator("#slot-list li")).toHaveCount(4)
    })
})
