import type { E2EScenarioInput } from "#type-declarations/testing";

import { defineE2ETestFile } from "../scenario-module";

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let targetSelector = null

            const moveToHtml = () => {
                targetSelector = "#html-host"
            }

            const moveToSvg = () => {
                targetSelector = "#svg-host"
            }
        </lang-js>

        <section data-page="target-directive-namespace-mismatch">
            <svg id="icon-root" viewBox="0 0 10 10">
                <circle id="moved-dot" #target={targetSelector} !r={2}></circle>
            </svg>

            <svg id="svg-host" viewBox="0 0 10 10"></svg>
            <div id="html-host"></div>

            <button id="btn-move-html" @click={moveToHtml}>Move to html</button>
            <button id="btn-move-svg" @click={moveToSvg}>Move to svg</button>
        </section>
    `,
};

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("warns when svg content is moved into an html container", async ({
        page,
        visitScenario,
    }) => {
        const warnings: string[] = [];
        page.on("console", message => {
            if (message.type() === "warning") {
                warnings.push(message.text());
            }
        });

        await visitScenario(scenario);
        expect(warnings).toEqual([]);

        await page.locator("#btn-move-html").click();

        await expect.poll(() => warnings.length).toBe(1);
        expect(warnings[0]).toContain("[QingKuai Warning](8005)");
        await expect(page.locator("#html-host > #moved-dot")).toHaveCount(1);
    });

    test("does not warn when svg content is moved into another svg container", async ({
        page,
        visitScenario,
    }) => {
        const warnings: string[] = [];
        page.on("console", message => {
            if (message.type() === "warning") {
                warnings.push(message.text());
            }
        });

        await visitScenario(scenario);
        await page.locator("#btn-move-svg").click();

        await expect(page.locator("#svg-host > #moved-dot")).toHaveCount(1);
        expect(warnings).toEqual([]);

        const namespace = await page.locator("#moved-dot").evaluate(node => node.namespaceURI);
        expect(namespace).toBe("http://www.w3.org/2000/svg");

        const box = await page.locator("#moved-dot").evaluate(node => {
            const rect = (node as SVGGraphicsElement).getBBox();
            return rect.width;
        });
        expect(box).toBe(4);
    });
});
