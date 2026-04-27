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

        <section data-page="svg-xlink-static-namespace">
            <svg id="svg-root" viewBox="0 0 40 40" width="40" height="40">
                <defs>
                    <g id="shape-a"><circle cx="20" cy="20" r="8"></circle></g>
                    <g id="shape-b"><rect x="10" y="10" width="20" height="20"></rect></g>
                </defs>

                <use id="icon-use" !xlink:href={iconHref}></use>
                <use id="icon-use-static" x="14" xlink:href="#shape-a"></use>
            </svg>

            <button id="switch-icon" @click={switchIcon}>Switch icon</button>
            <p id="state-href">Href: {iconHref}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("keeps static xlink attribute stable in namespace reads", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const staticHrefInitial = await page
            .locator("#icon-use-static")
            .evaluate(node => node.getAttributeNS("http://www.w3.org/1999/xlink", "href"))
        expect(staticHrefInitial).toBe("#shape-a")

        await page.locator("#switch-icon").click()
        await expect(page.locator("#state-href")).toHaveText("Href: #shape-b")

        const staticHrefAfterSwitch = await page
            .locator("#icon-use-static")
            .evaluate(node => node.getAttributeNS("http://www.w3.org/1999/xlink", "href"))
        expect(staticHrefAfterSwitch).toBe("#shape-a")
    })
})
