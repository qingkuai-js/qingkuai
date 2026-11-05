import type { E2EScenarioInput } from "#type-declarations/testing";

import { defineE2ETestFile } from "../scenario-module";

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let iconPath = '<path id="icon-path" d="M0 0h10v10H0z"></path>'
            let iconGroup = '<g id="icon-group"><circle id="icon-circle" cx="5" cy="5" r="5"></circle></g>'
            let spanMarkup = '<span id="html-span">hello</span>'

            let points = [1, 2]
            let showBranch = true

            const switchIcon = () => {
                iconPath = '<rect id="icon-rect" x="0" y="0" width="10" height="10"></rect>'
            }

            const hideBranch = () => {
                showBranch = false
            }
        </lang-js>

        <section data-page="html-svg-namespace">
            <svg id="svg-root" viewBox="0 0 10 10" #html>{iconPath}</svg>
            <svg id="svg-group" viewBox="0 0 10 10" #html>{iconGroup}</svg>
            <div id="html-container" #html>{spanMarkup}</div>

            <svg id="svg-fragment" viewBox="0 0 10 10">
                <circle #for={point of points} #key={point} !cx={point} !cy={point} r="1" class="row-circle"></circle>
                <rect #if={showBranch} class="branch-rect" x="0" y="0" width="4" height="4"></rect>
            </svg>

            <button id="btn-switch" @click={switchIcon}>Switch</button>
            <button id="btn-hide" @click={hideBranch}>Hide</button>
        </section>
    `,
};

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("html injected into svg uses the svg namespace", async ({ page, visitScenario }) => {
        await visitScenario(scenario);

        const pathNamespace = await page.locator("#icon-path").evaluate(node => node.namespaceURI);
        expect(pathNamespace).toBe("http://www.w3.org/2000/svg");

        const pathBox = await page.locator("#icon-path").evaluate(node => {
            const box = (node as SVGGraphicsElement).getBBox();
            return [box.width, box.height];
        });
        expect(pathBox).toEqual([10, 10]);

        const groupNamespace = await page
            .locator("#icon-group")
            .evaluate(node => node.namespaceURI);
        expect(groupNamespace).toBe("http://www.w3.org/2000/svg");

        const circleNamespace = await page
            .locator("#icon-circle")
            .evaluate(node => node.namespaceURI);
        expect(circleNamespace).toBe("http://www.w3.org/2000/svg");
    });

    test("html injected into html elements keeps the html namespace", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        const spanNamespace = await page.locator("#html-span").evaluate(node => node.namespaceURI);
        expect(spanNamespace).toBe("http://www.w3.org/1999/xhtml");
        await expect(page.locator("#html-span")).toHaveText("hello");
    });

    test("html re-rendered inside svg keeps the svg namespace", async ({ page, visitScenario }) => {
        await visitScenario(scenario);

        await page.locator("#btn-switch").click();
        await expect(page.locator("#icon-rect")).toBeAttached();

        const rectNamespace = await page.locator("#icon-rect").evaluate(node => node.namespaceURI);
        expect(rectNamespace).toBe("http://www.w3.org/2000/svg");
        await expect(page.locator("#icon-path")).toHaveCount(0);
    });

    test("list rows rendered inside svg use the svg namespace", async ({ page, visitScenario }) => {
        await visitScenario(scenario);

        await expect(page.locator(".row-circle")).toHaveCount(2);

        const namespaces = await page.locator(".row-circle").evaluateAll(nodes => {
            return nodes.map(node => node.namespaceURI);
        });
        expect(namespaces).toEqual(["http://www.w3.org/2000/svg", "http://www.w3.org/2000/svg"]);

        const boxes = await page.locator(".row-circle").evaluateAll(nodes => {
            return nodes.map(node => (node as SVGGraphicsElement).getBBox().width);
        });
        expect(boxes).toEqual([2, 2]);
    });

    test("conditional block rendered inside svg uses the svg namespace", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        await expect(page.locator(".branch-rect")).toBeAttached();
        const rectNamespace = await page
            .locator(".branch-rect")
            .evaluate(node => node.namespaceURI);
        expect(rectNamespace).toBe("http://www.w3.org/2000/svg");

        const rectBox = await page.locator(".branch-rect").evaluate(node => {
            return (node as SVGGraphicsElement).getBBox().width;
        });
        expect(rectBox).toBe(4);

        await page.locator("#btn-hide").click();
        await expect(page.locator(".branch-rect")).toHaveCount(0);
    });
});
