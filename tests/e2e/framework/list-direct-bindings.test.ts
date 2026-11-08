import type { E2EScenarioInput } from "#type-declarations/testing";

import { defineE2ETestFile } from "../scenario-module";

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import DirectList from "./components/DirectList"

            const makeRow = (id, name) => ({
                id,
                name,
                html: "<b>" + name + "</b>",
                items: [name + "-1", name + "-2"]
            })

            let rows = reactive([makeRow(1, "alpha"), makeRow(2, "beta")])

            const replaceFirst = () => {
                rows[0] = makeRow(1, "replaced")
            }

            const removeFirst = () => {
                rows = rows.filter(row => row.id !== 1)
            }
        </lang-js>

        <section data-page="list-direct-bindings">
            <button id="btn-replace" @click={replaceFirst}>Replace</button>
            <button id="btn-remove" @click={removeFirst}>Remove</button>

            <DirectList !rows={rows} />
        </section>
    `,
    components: {
        DirectList: `
            <ul id="direct-list">
                <li #for={item, index of props.rows} #key={item.id} !class={item.name}>
                    <span class="direct">{index}:{item.name}</span>
                    <i #for={entry of item.items} class="inner">{entry}</i>
                    <div class="html" #html>{item.html}</div>
                </li>
            </ul>
        `,
    },
};

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("direct rows follow a replaced item", async ({ page, visitScenario }) => {
        await visitScenario(scenario);

        await expect(page.locator("#direct-list .direct").nth(0)).toHaveText("0:alpha");
        await expect(page.locator("#direct-list .inner").nth(0)).toHaveText("alpha-1");
        await expect(page.locator("#direct-list .html").nth(0)).toHaveText("alpha");

        await page.locator("#btn-replace").click();

        await expect(page.locator("#direct-list .direct").nth(0)).toHaveText("0:replaced");
        await expect(page.locator("#direct-list li").nth(0)).toHaveClass(/replaced/);
        await expect(page.locator("#direct-list .inner").nth(0)).toHaveText("replaced-1");
        await expect(page.locator("#direct-list .html").nth(0)).toHaveText("replaced");
    });

    test("direct rows follow index shifts after removal", async ({ page, visitScenario }) => {
        await visitScenario(scenario);

        await expect(page.locator("#direct-list .direct").nth(1)).toHaveText("1:beta");

        await page.locator("#btn-remove").click();

        await expect(page.locator("#direct-list .direct")).toHaveCount(1);
        await expect(page.locator("#direct-list .direct")).toHaveText("0:beta");
        await expect(page.locator("#direct-list .inner").nth(0)).toHaveText("beta-1");
    });
});
