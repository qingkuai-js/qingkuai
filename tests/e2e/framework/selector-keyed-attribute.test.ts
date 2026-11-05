import type { Page } from "@playwright/test";
import type { E2EScenarioInput } from "#type-declarations/testing";

import { defineE2ETestFile } from "../scenario-module";

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let rows = [{ id: "a" }, { id: "b" }, { id: "c" }]
            let selected = "a"

            function pick(id) {
                selected = id
                return () => selected
            }

            function clearSelection() {
                selected = null
                return () => selected
            }
        </lang-js>

        <section data-page="selector-keyed-attribute">
            <div
                class="cell"
                #for={row of rows}
                #key={row.id}
                !title={selected === row.id ? "selected" : ""}
                !data-state={selected === row.id ? "on" : "off"}
                !data-id={row.id}
            ></div>

            <button id="pick-b" @click={pick("b")}>Pick b</button>
            <button id="pick-c" @click={pick("c")}>Pick c</button>
            <button id="clear" @click={clearSelection()}>Clear</button>

            <p id="state-selected">{selected}</p>
        </section>
    `,
};

const readAttributes = (page: Page) => {
    return page.locator(".cell").evaluateAll(nodes => {
        return nodes.map(node => ({
            id: node.getAttribute("data-id"),
            title: node.getAttribute("title"),
            state: node.getAttribute("data-state"),
        }));
    });
};

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("initial selection writes both attributes on the matching row", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        expect(await readAttributes(page)).toEqual([
            { id: "a", title: "selected", state: "on" },
            { id: "b", title: "", state: "off" },
            { id: "c", title: "", state: "off" },
        ]);
    });

    test("moving the selection moves both attributes", async ({ page, visitScenario }) => {
        await visitScenario(scenario);

        await page.locator("#pick-b").click();
        await expect(page.locator("#state-selected")).toHaveText("b");
        expect(await readAttributes(page)).toEqual([
            { id: "a", title: "", state: "off" },
            { id: "b", title: "selected", state: "on" },
            { id: "c", title: "", state: "off" },
        ]);
    });

    test("clearing the selection resets both attributes", async ({ page, visitScenario }) => {
        await visitScenario(scenario);

        await page.locator("#pick-c").click();
        await page.locator("#clear").click();

        expect(await readAttributes(page)).toEqual([
            { id: "a", title: "", state: "off" },
            { id: "b", title: "", state: "off" },
            { id: "c", title: "", state: "off" },
        ]);
    });
});
