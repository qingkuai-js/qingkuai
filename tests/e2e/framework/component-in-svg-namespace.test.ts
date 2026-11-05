import type { E2EScenarioInput } from "#type-declarations/testing";

import { defineE2ETestFile } from "../scenario-module";

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import Shape from "./components/svg-child/Shape"
            import Wrapper from "./components/svg-child/Wrapper"

            let label = "shape-on"
            let radius = 10
            let items = [{ id: 1 }]

            const change = () => {
                label = "shape-off"
                radius = 24
            }
        </lang-js>

        <section data-page="component-in-svg-namespace">
            <svg id="icon-root" viewBox="0 0 40 40">
                <Shape !label={label} !radius={radius} />
            </svg>

            <svg id="wrapper-root" viewBox="0 0 40 40">
                <Wrapper !label={label} !radius={radius} />
            </svg>

            <svg id="list-root" viewBox="0 0 40 40">
                <g #for={item of items} #key={item.id}>
                    <Shape !label={label} !radius={radius} />
                </g>
            </svg>

            <svg id="foreign-root" viewBox="0 0 40 40">
                <foreignObject x="0" y="0" width="40" height="40">
                    <div id="foreign-host">
                        <Shape !label={label} !radius={radius} />
                    </div>
                </foreignObject>
            </svg>

            <div id="html-root">
                <Shape !label={label} !radius={radius} />
            </div>

            <button id="btn-change" @click={change}>Change</button>
            <p id="state-label">{label}</p>
        </section>
    `,
    components: {
        "svg-child/Shape": `
            <g data-shape="shape">
                <circle data-dot !class={props.label} !r={props.radius}></circle>
            </g>
        `,
        "svg-child/Wrapper": `
            <lang-js>
                import Shape from "./Shape"
            </lang-js>

            <Shape !label={props.label} !radius={props.radius} />
        `,
    },
};

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("a component mounted in svg renders its content in the svg namespace", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        const dot = page.locator("#icon-root [data-dot]");
        expect(await dot.evaluate(node => node.namespaceURI)).toBe("http://www.w3.org/2000/svg");

        const box = await dot.evaluate(node => {
            const rect = (node as SVGGraphicsElement).getBBox();
            return [rect.width, rect.height];
        });
        expect(box).toEqual([20, 20]);
    });

    test("attributes of a component mounted in svg keep updating after mount", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        const dot = page.locator("#icon-root [data-dot]");
        await expect(dot).toHaveAttribute("class", "shape-on");
        await expect(dot).toHaveAttribute("r", "10");

        await page.locator("#btn-change").click();
        await expect(page.locator("#state-label")).toHaveText("shape-off");

        await expect(dot).toHaveAttribute("class", "shape-off");
        await expect(dot).toHaveAttribute("r", "24");

        const width = await dot.evaluate(node => {
            return (node as SVGGraphicsElement).getBBox().width;
        });
        expect(width).toBe(48);
    });

    test("the same component keeps the html namespace where it is mounted in html", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        const dot = page.locator("#html-root [data-dot]");
        expect(await dot.evaluate(node => node.namespaceURI)).toBe("http://www.w3.org/1999/xhtml");

        await page.locator("#btn-change").click();
        await expect(dot).toHaveAttribute("class", "shape-off");
        await expect(dot).toHaveAttribute("r", "24");
    });

    test("a component nested in another component inherits the svg namespace", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        const dot = page.locator("#wrapper-root [data-dot]");
        expect(await dot.evaluate(node => node.namespaceURI)).toBe("http://www.w3.org/2000/svg");

        const width = await dot.evaluate(node => {
            return (node as SVGGraphicsElement).getBBox().width;
        });
        expect(width).toBe(20);
    });

    test("a component inside a keyed list in svg keeps the svg namespace", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        const dot = page.locator("#list-root [data-dot]");
        expect(await dot.evaluate(node => node.namespaceURI)).toBe("http://www.w3.org/2000/svg");

        const width = await dot.evaluate(node => {
            return (node as SVGGraphicsElement).getBBox().width;
        });
        expect(width).toBe(20);
    });

    test("a component inside foreignObject stays in the html namespace", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        const dot = page.locator("#foreign-root [data-dot]");
        expect(await dot.evaluate(node => node.namespaceURI)).toBe("http://www.w3.org/1999/xhtml");

        await page.locator("#btn-change").click();
        await expect(dot).toHaveAttribute("class", "shape-off");
    });
});
