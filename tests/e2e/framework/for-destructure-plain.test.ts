import type { E2EScenarioInput } from "#type-declarations/testing";

import { defineE2ETestFile } from "../scenario-module";

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let rows = reactive([
                {
                    id: 1,
                    value: "alpha"
                },
                {
                    id: 2,
                    value: "beta"
                }
            ])

            let selected = 1

            const record = value => {
                document.querySelector("#destructure-log").textContent = String(value)
            }

            const replaceRows = () => {
                rows = [
                    {
                        id: 1,
                        value: "alpha2"
                    },
                    {
                        id: 2,
                        value: "beta"
                    }
                ]
            }

            const selectSecond = () => {
                selected = 2
            }
        </lang-js>

        <section data-page="for-destructure-plain">
            <div id="destructure-log"></div>
            <button id="btn-replace" @click={replaceRows}>Replace</button>
            <button id="btn-select-second" @click={selectSecond}>Select second</button>

            <ul id="event-list">
                <li #for={{ id, value } of rows}>
                    <button class="event-row" @click={() => record(value)}>log</button>
                </li>
            </ul>

            <ul id="selector-list">
                <li
                    #for={{ id, value } of rows}
                    #key={id}
                    !class={selected === id ? "selected" : ""}
                    @click={() => record(value)}
                >x</li>
            </ul>
        </section>
    `,
};

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("initializes destructured values for a plain row without render bindings", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        await expect(page).toHaveTitle("for-destructure-plain");

        await page.locator("#event-list .event-row").nth(0).click();
        await expect(page.locator("#destructure-log")).toHaveText("alpha");
    });

    test("keeps destructured event values fresh after the list is replaced", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        await page.locator("#btn-replace").click();
        await page.locator("#event-list .event-row").nth(0).click();
        await expect(page.locator("#destructure-log")).toHaveText("alpha2");
    });

    test("initializes the selector-managed class of a plain destructured row", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        await expect(page.locator("#selector-list li").nth(0)).toHaveClass("selected");

        await page.locator("#btn-select-second").click();
        await expect(page.locator("#selector-list li").nth(0)).not.toHaveClass("selected");
        await expect(page.locator("#selector-list li").nth(1)).toHaveClass("selected");
    });
});
