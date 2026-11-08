import type { E2EScenarioInput } from "#type-declarations/testing";

import { defineE2ETestFile } from "../scenario-module";

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import ScopeList from "./components/ScopeList"

            let rows = reactive([
                { id: 1, visible: true, name: "alpha" },
                { id: 2, visible: true, name: "beta" }
            ])

            const renameInPlace = () => {
                rows[0].name = "renamed"
            }

            const replaceFirst = () => {
                rows[0] = { id: 1, visible: true, name: "replaced" }
            }

            const removeFirst = () => {
                rows = rows.filter(row => row.id !== 1)
            }
        </lang-js>

        <section data-page="component-keyed-row-scope-refresh">
            <h1 id="title">Keyed Row Scope Refresh</h1>
            <button id="btn-rename" @click={renameInPlace}>Rename</button>
            <button id="btn-replace" @click={replaceFirst}>Replace</button>
            <button id="btn-remove" @click={removeFirst}>Remove</button>

            <ScopeList !rows={rows}>
                <qk:spread #slot={ctx from "default"}>
                    <span class="slot-cell">{ctx.index}:{ctx.row.name}</span>
                    <i class="slot-branch" #if={ctx.row.visible}>{ctx.row.name}</i>
                </qk:spread>
            </ScopeList>
        </section>
    `,
    components: {
        ScopeList: `
            <ul id="scope-list">
                <li #for={row, index of props.rows} #key={row.id}>
                    <span class="direct">{row.name}</span>
                    <div class="branch" #if={row.visible}>
                        {row.name}
                        <input class="keep" />
                    </div>
                    <div class="portal" #target={"body"}>{row.name}</div>
                    <slot !row={row} !index={index} />
                </li>
            </ul>
        `,
    },
};

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("row scope refreshes when an item is replaced", async ({ page, visitScenario }) => {
        await visitScenario(scenario);
        await expect(page).toHaveTitle("component-keyed-row-scope-refresh");

        // 初始：行级绑定、分支、插槽内容、#target 内容都是首行的值
        // Initial: row-level bindings, branches, slot content,
        // and `#target` content are all the values of the first row
        await expect(page.locator("#scope-list .direct").nth(0)).toHaveText("alpha");
        await expect(page.locator("#scope-list .branch").nth(0)).toContainText("alpha");
        await expect(page.locator("#scope-list .slot-cell").nth(0)).toHaveText("0:alpha");
        await expect(page.locator("#scope-list .slot-branch").nth(0)).toHaveText("alpha");
        await expect(page.locator("body > .portal").nth(0)).toHaveText("alpha");

        // 原地改属性：所有位置都应更新
        // In-place property change: all locations should update
        await page.locator("#btn-rename").click();
        await expect(page.locator("#scope-list .direct").nth(0)).toHaveText("renamed");
        await expect(page.locator("#scope-list .branch").nth(0)).toContainText("renamed");
        await expect(page.locator("#scope-list .slot-cell").nth(0)).toHaveText("0:renamed");
        await expect(page.locator("#scope-list .slot-branch").nth(0)).toHaveText("renamed");
        await expect(page.locator("body > .portal").nth(0)).toHaveText("renamed");

        // 整体替换数据项（key 不变）：行作用域内的绑定都要跟着换
        // Replacing the entire data item (key unchanged): all bindings within the row scope should update
        await page.locator("#btn-replace").click();
        await expect(page.locator("#scope-list .direct").nth(0)).toHaveText("replaced");
        await expect(page.locator("#scope-list .branch").nth(0)).toContainText("replaced");
        await expect(page.locator("#scope-list .slot-cell").nth(0)).toHaveText("0:replaced");
        await expect(page.locator("#scope-list .slot-branch").nth(0)).toHaveText("replaced");
        await expect(page.locator("body > .portal").nth(0)).toHaveText("replaced");
    });

    test("slot context index follows row reordering after removal", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        await expect(page.locator("#scope-list .slot-cell").nth(1)).toHaveText("1:beta");

        await page.locator("#btn-remove").click();

        // 剩余行前移：插槽上下文里的 index 也要跟着变
        // The remaining row moves forward: the index in the slot context should also change accordingly
        await expect(page.locator("#scope-list .slot-cell")).toHaveCount(1);
        await expect(page.locator("#scope-list .slot-cell")).toHaveText("0:beta");
        await expect(page.locator("#scope-list .direct")).toHaveText("beta");
    });

    test("re-running row scopes keeps existing DOM state", async ({ page, visitScenario }) => {
        await visitScenario(scenario);

        const input = page.locator("#scope-list .keep").nth(0);
        await input.fill("typed value");

        await page.locator("#btn-replace").click();
        await expect(page.locator("#scope-list .branch").nth(0)).toContainText("replaced");

        // 绑定重跑但节点不重建：输入值保留
        // The binding is rerun but the node is not rebuilt: the input value should be preserved
        await expect(page.locator("#scope-list .keep").nth(0)).toHaveValue("typed value");
    });
});
