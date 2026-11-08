import type { E2EScenarioInput } from "#type-declarations/testing";

import { defineE2ETestFile } from "../scenario-module";

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import CellList from "./components/CellList"
            import CellBadge from "./components/CellBadge"

            let rows = reactive([
                { id: 1, visible: true, name: "alpha" },
                { id: 2, visible: true, name: "beta" }
            ])

            const replaceFirst = () => {
                rows[0] = { id: 1, visible: true, name: "replaced" }
            }
        </lang-js>

        <section data-page="list-cell-context">
            <button id="btn-replace" @click={replaceFirst}>Replace</button>

            <CellList !rows={rows}>
                <qk:spread #slot={ctx from "default"}>
                    <span class="slot-cell">{ctx.index}:{ctx.row.name}</span>
                    <CellBadge !label={ctx.row.name} />
                </qk:spread>
            </CellList>
        </section>
    `,
    components: {
        CellBadge: `
            <b class="badge">{props.label}</b>
        `,
        CellList: `
            <lang-js>
                import CellBadge from "./CellBadge"

                let itemCalls = 0
                let noiseCalls = 0

                const countItem = () => {
                    itemCalls++
                    return "item-" + itemCalls
                }

                const countNoise = () => {
                    noiseCalls++
                    return "noise-" + noiseCalls
                }
            </lang-js>

            <ul id="cell-list">
                <li #for={row, index of props.rows} #key={row.id}>
                    <span class="with-item">{countItem()}:{row.name}</span>

                    <CellBadge !label={row.name} />

                    <div class="branch" #if={row.visible}>
                        <span class="branch-noise">{countNoise()}</span>
                    </div>

                    <slot !row={row} !index={index} />
                </li>
            </ul>
        `,
    },
};

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("component props and slot content follow a replaced row", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        await expect(page.locator("#cell-list .badge").nth(0)).toHaveText("alpha");
        await expect(page.locator("#cell-list .slot-cell").nth(0)).toHaveText("0:alpha");

        await page.locator("#btn-replace").click();

        await expect(page.locator("#cell-list .with-item").nth(0)).toContainText(":replaced");
        await expect(page.locator("#cell-list .badge").nth(0)).toHaveText("replaced");
        await expect(page.locator("#cell-list .slot-cell").nth(0)).toHaveText("0:replaced");
    });

    test("component rendered as slot content follows a replaced row", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        const badges = page.locator("#cell-list .slot-cell ~ .badge");
        await expect(badges.nth(0)).toHaveText("alpha");

        await page.locator("#btn-replace").click();

        await expect(badges.nth(0)).toHaveText("replaced");
    });

    test("branch bindings that do not read the item are not re-run", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        await expect(page.locator("#cell-list .branch-noise").nth(0)).toHaveText("noise-1");

        await page.locator("#btn-replace").click();

        await expect(page.locator("#cell-list .with-item").nth(0)).toContainText("item-3");
        await expect(page.locator("#cell-list .branch-noise").nth(0)).toHaveText("noise-1");
        await expect(page.locator("#cell-list .branch-noise").nth(1)).toHaveText("noise-2");
    });
});
