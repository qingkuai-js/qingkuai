import type { E2EScenarioInput } from "#type-declarations/testing";

import { defineE2ETestFile } from "../scenario-module";

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import Child from "./components/Child"
            import PropChild from "./components/PropChild"

            let version = 0
            const sharedItems = [{ id: "x" }, { id: "y" }]

            let rows = reactive([
                { id: 1, label: "alpha", visible: true, items: ["a1", "a2"] },
                { id: 2, label: "beta", visible: true, items: ["b1"] }
            ])

            const record = value => {
                document.querySelector("#legacy-log").textContent = String(value)
            }

            const replaceRows = () => {
                rows = [
                    { id: 1, label: "alpha2", visible: false, items: ["a3"] },
                    { id: 2, label: "beta", visible: true, items: ["b1"] }
                ]
                version = version + 1
            }
        </lang-js>

        <section data-page="for-destructure-legacy">
            <div id="legacy-log"></div>
            <button id="btn-replace" @click={replaceRows}>Replace</button>

            <ul id="child-list">
                <li #for={{ id, label } of rows} #key={id}>
                    <Child !label={label} />
                    <button class="child-event" @click={() => record(label)}>log</button>
                </li>
            </ul>

            <ul id="condition-list">
                <li #for={{ id, label, visible } of rows} #key={id}>
                    <span class="condition-branch" #if={visible}>{label}</span>
                </li>
            </ul>

            <ul id="nested-list">
                <li #for={{ id, label, items } of rows} #key={id}>
                    <span class="nested-item" #for={item of items}>{label}:{item}</span>
                </li>
            </ul>

            <ul id="slot-list">
                <li #for={{ id, label } of rows} #key={id}>
                    <span class="direct">{label}</span>
                    <Child !label={label}>
                        <span class="slot-label">{label}</span>
                    </Child>
                </li>
            </ul>

            <ul id="prop-list">
                <li #for={{ id, label } of rows} #key={id}>
                    <PropChild !onSelect={() => record(label)} />
                </li>
            </ul>

            <ul id="outer-key-list">
                <li #for={{ id, label } of rows} #key={id}>
                    <span
                        class="outer-key-inner"
                        #for={item of version >= 0 ? sharedItems : []}
                        #key={label + ":" + item.id}
                    >
                        <input class="outer-key-input" />
                        {item.id}
                    </span>
                </li>
            </ul>

        </section>
    `,
    components: {
        Child: `
            <span class="child-label">{props.label}</span>
            <span class="slot-host"><slot /></span>
        `,
        PropChild: `
            <button class="prop-trigger" @click={props.onSelect}>trigger</button>
        `,
    },
};

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("refreshes child component props from a destructured legacy row", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        await expect(page).toHaveTitle("for-destructure-legacy");
        await expect(page.locator("#child-list .child-label")).toHaveText(["alpha", "beta"]);

        await page.locator("#btn-replace").click();
        await expect(page.locator("#child-list .child-label")).toHaveText(["alpha2", "beta"]);
    });

    test("refreshes event handlers from a destructured legacy row", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        await page.locator("#btn-replace").click();
        await page.locator("#child-list .child-event").nth(0).click();
        await expect(page.locator("#legacy-log")).toHaveText("alpha2");
    });

    test("re-evaluates conditions from a destructured legacy row", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        await expect(page.locator("#condition-list .condition-branch")).toHaveCount(2);

        await page.locator("#btn-replace").click();
        await expect(page.locator("#condition-list .condition-branch")).toHaveCount(1);
        await expect(page.locator("#condition-list .condition-branch")).toHaveText("beta");
    });

    test("refreshes nested lists from a destructured legacy row", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        await expect(page.locator("#nested-list .nested-item")).toHaveText([
            "alpha:a1",
            "alpha:a2",
            "beta:b1",
        ]);

        await page.locator("#btn-replace").click();
        await expect(page.locator("#nested-list .nested-item")).toHaveText([
            "alpha2:a3",
            "beta:b1",
        ]);
    });

    test("refreshes slot content after the row binding refreshed locals", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        await expect(page.locator("#slot-list .direct")).toHaveText(["alpha", "beta"]);
        await expect(page.locator("#slot-list .slot-label")).toHaveText(["alpha", "beta"]);

        await page.locator("#btn-replace").click();
        await expect(page.locator("#slot-list .direct")).toHaveText(["alpha2", "beta"]);
        await expect(page.locator("#slot-list .slot-label")).toHaveText(["alpha2", "beta"]);
    });

    test("function props read fresh destructured values after row reuse", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        await page.locator("#prop-list .prop-trigger").nth(0).click();
        await expect(page.locator("#legacy-log")).toHaveText("alpha");

        await page.locator("#btn-replace").click();
        await page.locator("#prop-list .prop-trigger").nth(0).click();
        await expect(page.locator("#legacy-log")).toHaveText("alpha2");
    });

    test("keys referencing outer destructured values refresh after row reuse", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        const firstInput = page.locator("#outer-key-list .outer-key-input").nth(0);
        await firstInput.fill("typed");
        await expect(firstInput).toHaveValue("typed");

        await page.locator("#btn-replace").click();
        await expect(page.locator("#outer-key-list .outer-key-input").nth(0)).toHaveValue("");
    });
});
