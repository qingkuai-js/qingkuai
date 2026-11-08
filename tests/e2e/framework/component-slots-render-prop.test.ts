import type { E2EScenarioInput } from "#type-declarations/testing";

import { defineE2ETestFile } from "../scenario-module";

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import RowSlotList from "./components/RowSlotList"
            import SlotProbe from "./components/SlotProbe"

            let rows = reactive([
                { id: 1, name: "alpha" },
                { id: 2, name: "beta" }
            ])

            globalThis.__slotDestroyed = 0

            const renameFirst = () => {
                rows[0].name = "renamed"
            }

            const removeFirst = () => {
                rows = rows.filter(row => row.id !== 1)
            }
        </lang-js>

        <section data-page="component-slots-render-prop">
            <h1 id="title">Render Prop Slots</h1>
            <button id="btn-rename" @click={renameFirst}>Rename</button>
            <button id="btn-remove" @click={removeFirst}>Remove first</button>

            <RowSlotList !rows={rows}>
                <span class="row-cell" #slot={{ row } from "default"}>
                    {row.name}
                    <SlotProbe />
                </span>
            </RowSlotList>
        </section>
    `,
    components: {
        RowSlotList: `
            <ul id="row-slot-list">
                <li #for={row of props.rows} #key={row.id}>
                    <slot !row={row} />
                </li>
            </ul>
        `,
        SlotProbe: `
            <lang-js>
                onBeforeDestroy(() => {
                    globalThis.__slotDestroyed++
                })
            </lang-js>

            <i class="slot-probe">probe</i>
        `,
    },
};

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("slot content is rendered once per row and follows row updates", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);
        await expect(page).toHaveTitle("component-slots-render-prop");

        // 每一行各调用一次插槽内容
        // The slot content is invoked once per row
        await expect(page.locator("#row-slot-list .row-cell")).toHaveCount(2);
        await expect(page.locator("#row-slot-list .row-cell").nth(0)).toContainText("alpha");
        await expect(page.locator("#row-slot-list .row-cell").nth(1)).toContainText("beta");
        await expect(page.locator("#row-slot-list .slot-probe")).toHaveCount(2);

        // 行数据更新：该行插槽内容更新，其他行不受影响
        // Row data update: that row's slot content updates, other rows untouched
        await page.locator("#btn-rename").click();
        await expect(page.locator("#row-slot-list .row-cell").nth(0)).toContainText("renamed");
        await expect(page.locator("#row-slot-list .row-cell").nth(1)).toContainText("beta");
    });

    test("removing a row destroys the slot content mounted for that row", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        await expect(page.locator("#row-slot-list .slot-probe")).toHaveCount(2);
        await expect.poll(() => page.evaluate(() => (globalThis as any).__slotDestroyed)).toBe(0);

        await page.locator("#btn-remove").click();

        // 被删除行的插槽内容随行销毁，剩余行不受影响
        // The removed row's slot content is destroyed with the row; the remaining row is untouched
        await expect(page.locator("#row-slot-list .row-cell")).toHaveCount(1);
        await expect(page.locator("#row-slot-list .row-cell")).toContainText("beta");
        await expect.poll(() => page.evaluate(() => (globalThis as any).__slotDestroyed)).toBe(1);
    });
});
