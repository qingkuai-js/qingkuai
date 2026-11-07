import type { E2EScenarioInput } from "#type-declarations/testing";

import { defineE2ETestFile } from "../scenario-module";

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import HtmlSlotHost from "./components/HtmlSlotHost"

            let rawHtml = '<strong id="slot-html-strong">Slot html</strong>'
            let spreadHtml = '<b id="slot-spread-inner">Spread slot html</b>'

            const setUpdatedHtml = () => {
                rawHtml = '<em id="slot-html-em">Slot html updated</em>'
            }

            const setSpreadUpdated = () => {
                spreadHtml = '<u id="slot-spread-updated">Spread slot updated</u>'
            }
        </lang-js>

        <section data-page="component-slots-named-html">
            <h1 id="title">Named Slots With Html Directive</h1>
            <button id="btn-update" @click={setUpdatedHtml}>Update html</button>
            <button id="btn-spread-update" @click={setSpreadUpdated}>Update spread html</button>

            <HtmlSlotHost>
                <div id="slot-html-content" #slot={"body"} #html>{rawHtml}</div>
                <qk:spread #slot={"spread"} #html>{spreadHtml}</qk:spread>
            </HtmlSlotHost>
        </section>
    `,
    components: {
        HtmlSlotHost: `
            <article id="slot-html-host">
                <div id="slot-body-host"><slot name="body" /></div>
                <div id="slot-spread-html-host"><slot name="spread" /></div>
            </article>
        `,
    },
};

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("named slot content renders html and updates reactively", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        await expect(page).toHaveTitle("component-slots-named-html");
        await expect(page.locator("#slot-body-host #slot-html-strong")).toHaveText("Slot html");
        await expect(page.locator("#slot-body-host #slot-html-em")).toHaveCount(0);

        await page.locator("#btn-update").click();
        await expect(page.locator("#slot-body-host #slot-html-em")).toHaveText("Slot html updated");
        await expect(page.locator("#slot-body-host #slot-html-strong")).toHaveCount(0);
    });

    test("named slot on qk spread renders html and updates reactively", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        await expect(page.locator("#slot-spread-html-host #slot-spread-inner")).toHaveText(
            "Spread slot html",
        );
        await expect(page.locator("#slot-spread-html-host #slot-spread-updated")).toHaveCount(0);

        await page.locator("#btn-spread-update").click();
        await expect(page.locator("#slot-spread-html-host #slot-spread-updated")).toHaveText(
            "Spread slot updated",
        );
        await expect(page.locator("#slot-spread-html-host #slot-spread-inner")).toHaveCount(0);
    });
});
