import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let iconHref = "#shape-a"

            const switchIcon = () => {
                iconHref = iconHref === "#shape-a" ? "#shape-b" : "#shape-a"
            }
        </lang-js>

        <section data-page="svg-xlink-geometry-switch">
            <svg id="svg-root" viewBox="0 0 50 50" width="50" height="50">
                <defs>
                    <g id="shape-a"><circle cx="25" cy="25" r="4"></circle></g>
                    <g id="shape-b"><rect x="8" y="20" width="34" height="10"></rect></g>
                </defs>

                <use id="icon-use" !xlink:href={iconHref}></use>
            </svg>

            <button id="switch-icon" @click={switchIcon}>Switch icon</button>
            <p id="state-href">Href: {iconHref}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("changes rendered geometry when xlink target switches", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const bboxBefore = await page.locator("#icon-use").evaluate(node => {
            const box = (node as SVGGraphicsElement).getBBox()
            return { width: box.width, height: box.height }
        })
        expect(Math.round(bboxBefore.width)).toBe(8)
        expect(Math.round(bboxBefore.height)).toBe(8)

        await page.locator("#switch-icon").click()
        await expect(page.locator("#state-href")).toHaveText("Href: #shape-b")

        const bboxAfter = await page.locator("#icon-use").evaluate(node => {
            const box = (node as SVGGraphicsElement).getBBox()
            return { width: box.width, height: box.height }
        })
        expect(Math.round(bboxAfter.width)).toBe(34)
        expect(Math.round(bboxAfter.height)).toBe(10)
    })
})
