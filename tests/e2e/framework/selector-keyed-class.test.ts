import type { Page } from "@playwright/test";
import type { E2EScenarioInput } from "#type-declarations/testing";

import { defineE2ETestFile } from "../scenario-module";

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let rows = [{ id: 1 }, { id: 2 }, { id: 3 }]
            let selected = 1

            function pick(id) {
                selected = id
                return () => selected
            }

            function clearSelection() {
                selected = null
                return () => selected
            }

            function reorderRows() {
                rows = rows.slice().reverse()
                return () => rows
            }

            function removeFirstRow() {
                rows = rows.slice(1)
                return () => rows
            }
        </lang-js>

        <section data-page="selector-keyed-class">
            <div
                class="row base"
                #for={row of rows}
                #key={row.id}
                !class={selected === row.id ? "on" : ""}
                !data-id={row.id}
            ></div>

            <button id="pick-2" @click={pick(2)}>Pick 2</button>
            <button id="pick-3" @click={pick(3)}>Pick 3</button>
            <button id="pick-99" @click={pick(99)}>Pick 99</button>
            <button id="clear" @click={clearSelection()}>Clear</button>
            <button id="reorder" @click={reorderRows()}>Reorder</button>
            <button id="remove-first" @click={removeFirstRow()}>Remove first</button>

            <p id="state-selected">{selected}</p>
        </section>
    `,
};

const readClasses = (page: Page) => {
    return page.locator(".row").evaluateAll(nodes => {
        return nodes.map(node => ({
            id: node.getAttribute("data-id"),
            cls: (node.getAttribute("class") || "").trim(),
        }));
    });
};

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("initial selection marks only the matching row", async ({ page, visitScenario }) => {
        await visitScenario(scenario);

        expect(await readClasses(page)).toEqual([
            { id: "1", cls: "row base on" },
            { id: "2", cls: "row base" },
            { id: "3", cls: "row base" },
        ]);
    });

    test("moving the selection clears the previous row and marks the next one", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        await page.locator("#pick-2").click();
        await expect(page.locator("#state-selected")).toHaveText("2");
        expect(await readClasses(page)).toEqual([
            { id: "1", cls: "row base" },
            { id: "2", cls: "row base on" },
            { id: "3", cls: "row base" },
        ]);

        await page.locator("#pick-3").click();
        expect(await readClasses(page)).toEqual([
            { id: "1", cls: "row base" },
            { id: "2", cls: "row base" },
            { id: "3", cls: "row base on" },
        ]);
    });

    test("selecting a key that is not in the list clears every row", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        await page.locator("#pick-2").click();
        await page.locator("#pick-99").click();

        expect(await readClasses(page)).toEqual([
            { id: "1", cls: "row base" },
            { id: "2", cls: "row base" },
            { id: "3", cls: "row base" },
        ]);
    });

    test("clearing the selection removes the marker from the previous row", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        await page.locator("#pick-3").click();
        await page.locator("#clear").click();

        expect(await readClasses(page)).toEqual([
            { id: "1", cls: "row base" },
            { id: "2", cls: "row base" },
            { id: "3", cls: "row base" },
        ]);
    });

    test("reordering rows keeps the marker on the same key", async ({ page, visitScenario }) => {
        await visitScenario(scenario);

        await page.locator("#pick-2").click();
        await page.locator("#reorder").click();

        expect(await readClasses(page)).toEqual([
            { id: "3", cls: "row base" },
            { id: "2", cls: "row base on" },
            { id: "1", cls: "row base" },
        ]);
    });

    test("removing the selected row leaves the rest unmarked", async ({ page, visitScenario }) => {
        await visitScenario(scenario);

        await page.locator("#remove-first").click();

        expect(await readClasses(page)).toEqual([
            { id: "2", cls: "row base" },
            { id: "3", cls: "row base" },
        ]);

        await page.locator("#pick-3").click();
        expect(await readClasses(page)).toEqual([
            { id: "2", cls: "row base" },
            { id: "3", cls: "row base on" },
        ]);
    });
});
