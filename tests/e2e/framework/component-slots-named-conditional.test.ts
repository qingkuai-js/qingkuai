import type { E2EScenarioInput } from "#type-declarations/testing";

import { defineE2ETestFile } from "../scenario-module";

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import NamedSlotHost from "./components/NamedSlotHost"

            let visible = true
            let items = reactive([1, 2])

            const toggle = () => {
                visible = !visible
            }

            const addItem = () => {
                items = [...items, items.length + 1]
            }
        </lang-js>

        <section data-page="component-slots-named-conditional">
            <h1 id="title">Named Slots With Directives</h1>
            <button id="btn-toggle" @click={toggle}>Toggle</button>
            <button id="btn-add" @click={addItem}>Add item</button>

            <NamedSlotHost>
                <span id="slot-flag-content" #slot={"flag"} #if={visible}>Flag is on</span>
                <ul id="slot-list-content" #slot={"list"} #for={item of items}>
                    <li>Item {item}</li>
                </ul>
                <p id="slot-static-content" #slot={"static"}>Always here</p>
            </NamedSlotHost>
        </section>
    `,
    components: {
        NamedSlotHost: `
            <section id="named-slot-host">
                <div id="slot-flag-host"><slot name="flag" /></div>
                <div id="slot-list-host"><slot name="list" /></div>
                <div id="slot-static-host"><slot name="static" /></div>
            </section>
        `,
    },
};

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("named slot content supports #if and #for with reactive updates", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);
        await expect(page).toHaveTitle("component-slots-named-conditional");

        // 初始：条件插槽渲染，其余插槽不受影响
        // Initial: conditional slot renders, other slots unaffected
        await expect(page.locator("#slot-flag-content")).toHaveText("Flag is on");
        await expect(page.locator("#slot-list-content li")).toHaveCount(2);
        await expect(page.locator("#slot-static-content")).toHaveText("Always here");

        // 隐藏条件插槽 → 仅它被移除
        // Hide the conditional slot → only it is removed
        await page.locator("#btn-toggle").click();
        await expect(page.locator("#slot-flag-content")).toHaveCount(0);
        await expect(page.locator("#slot-list-content li")).toHaveCount(2);
        await expect(page.locator("#slot-static-content")).toHaveText("Always here");

        // 再次显示 → 恢复
        // Show again → restore
        await page.locator("#btn-toggle").click();
        await expect(page.locator("#slot-flag-content")).toHaveText("Flag is on");

        // 列表插槽的响应式更新
        // Reactive update of the list slot
        await page.locator("#btn-add").click();
        await expect(page.locator("#slot-list-content li")).toHaveCount(3);
        await expect(page.locator("#slot-list-content li").nth(2)).toHaveText("Item 3");
    });
});
