import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let iconHref = "#shape-a"
            let iconFill = "red"
            let iconSize = 24

            const switchIcon = () => {
                iconHref = iconHref === "#shape-a" ? "#shape-b" : "#shape-a"
                iconFill = iconFill === "red" ? "blue" : "red"
                iconSize = iconSize === 24 ? 36 : 24
            }
        </lang-js>

        <section data-page="svg-xlink-rendering">
            <svg id="svg-root" viewBox="0 0 40 40" !width={iconSize} !height={iconSize}>
                <defs>
                    <g id="shape-a">
                        <circle cx="20" cy="20" r="10"></circle>
                    </g>
                    <g id="shape-b">
                        <rect x="10" y="10" width="20" height="20"></rect>
                    </g>
                </defs>

                <use id="icon-use" !xlink:href={iconHref} !fill={iconFill}></use>
                <use id="icon-use-static" x="12" xlink:href="#shape-a"></use>
            </svg>

            <button id="switch-icon" @click={switchIcon}>Switch icon</button>

            <p id="state-href">Href: {iconHref}</p>
            <p id="state-fill">Fill: {iconFill}</p>
            <p id="state-size">Size: {iconSize}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("renders svg namespace and initializes xlink attributes", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#state-href")).toHaveText("Href: #shape-a")
        await expect(page.locator("#state-fill")).toHaveText("Fill: red")
        await expect(page.locator("#state-size")).toHaveText("Size: 24")

        const svgNamespace = await page
            .locator("#svg-root")
            .evaluate(node => (node as SVGElement).namespaceURI)
        expect(svgNamespace).toBe("http://www.w3.org/2000/svg")

        const dynamicXlinkHref = await page
            .locator("#icon-use")
            .evaluate(node => node.getAttributeNS("http://www.w3.org/1999/xlink", "href"))
        expect(dynamicXlinkHref).toBe("#shape-a")

        const staticXlinkHref = await page
            .locator("#icon-use-static")
            .evaluate(node => node.getAttribute("xlink:href"))
        expect(staticXlinkHref).toBe("#shape-a")
    })

    test("updates dynamic xlink href and svg attributes after interaction", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#switch-icon").click()

        await expect(page.locator("#state-href")).toHaveText("Href: #shape-b")
        await expect(page.locator("#state-fill")).toHaveText("Fill: blue")
        await expect(page.locator("#state-size")).toHaveText("Size: 36")

        const dynamicXlinkHref = await page
            .locator("#icon-use")
            .evaluate(node => node.getAttributeNS("http://www.w3.org/1999/xlink", "href"))
        expect(dynamicXlinkHref).toBe("#shape-b")

        const staticXlinkHrefAfterSwitch = await page
            .locator("#icon-use-static")
            .evaluate(node => node.getAttributeNS("http://www.w3.org/1999/xlink", "href"))
        expect(staticXlinkHrefAfterSwitch).toBe("#shape-a")

        await expect(page.locator("#icon-use")).toHaveAttribute("fill", "blue")
        await expect(page.locator("#svg-root")).toHaveAttribute("width", "36")

        await page.locator("#switch-icon").click()
        await expect(page.locator("#state-href")).toHaveText("Href: #shape-a")
        await expect(page.locator("#icon-use")).toHaveAttribute("fill", "red")

        const staticXlinkHrefAfterReset = await page
            .locator("#icon-use-static")
            .evaluate(node => node.getAttributeNS("http://www.w3.org/1999/xlink", "href"))
        expect(staticXlinkHrefAfterReset).toBe("#shape-a")
    })
})
