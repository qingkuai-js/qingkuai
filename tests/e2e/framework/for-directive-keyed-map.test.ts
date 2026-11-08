import type { E2EScenarioInput } from "#type-declarations/testing";

import { defineE2ETestFile } from "../scenario-module";

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            const makeRow = name => ({ name })
            const objectKey = { id: "b" }

            let stringMap = reactive(new Map([
                ["a", makeRow("Alpha")],
                ["b", makeRow("Beta")]
            ]))
            let objectMap = reactive(new Map([
                [objectKey, makeRow("Gamma")]
            ]))

            const reorderStringMap = () => {
                stringMap = new Map([
                    ["b", makeRow("Beta2")],
                    ["a", makeRow("Alpha2")]
                ])
            }

            const replaceObjectMap = () => {
                objectMap = new Map([
                    [objectKey, makeRow("Gamma2")]
                ])
            }
        </lang-js>

        <section data-page="for-directive-keyed-map">
            <button id="btn-reorder" @click={reorderStringMap}>Reorder</button>
            <button id="btn-replace" @click={replaceObjectMap}>Replace</button>

            <ul id="string-map-list">
                <li #for={value, key of stringMap} #key={key} class="string-row">
                    <input class="local-input" />
                    <span class="label">{key}:{value.name}</span>
                </li>
            </ul>

            <ul id="object-map-list">
                <li #for={value, key of objectMap} #key={key} class="object-row">
                    <input class="local-input" />
                    <span class="label">{value.name}</span>
                </li>
            </ul>
        </section>
    `,
};

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("keys a map list by its string keys and keeps row state on reorder", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        await expect(page.locator("#string-map-list .label")).toHaveText(["a:Alpha", "b:Beta"]);

        await page.locator("#string-map-list .local-input").nth(0).fill("typed");

        await page.locator("#btn-reorder").click();

        await expect(page.locator("#string-map-list .label")).toHaveText(["b:Beta2", "a:Alpha2"]);
        await expect(page.locator("#string-map-list .local-input").nth(0)).toHaveValue("");
        await expect(page.locator("#string-map-list .local-input").nth(1)).toHaveValue("typed");
    });

    test("keys a map list by object key identity", async ({ page, visitScenario }) => {
        await visitScenario(scenario);

        await expect(page.locator("#object-map-list .label")).toHaveText(["Gamma"]);

        await page.locator("#object-map-list .local-input").fill("typed");

        await page.locator("#btn-replace").click();

        await expect(page.locator("#object-map-list .label")).toHaveText(["Gamma2"]);
        await expect(page.locator("#object-map-list .local-input")).toHaveValue("typed");
    });
});
