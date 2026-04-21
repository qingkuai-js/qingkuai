import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let showSvg = true
            let iconHref = "#shape-a"

            const toggleShow = () => {
                showSvg = !showSvg
            }

            const switchIcon = () => {
                iconHref = iconHref === "#shape-a" ? "#shape-b" : "#shape-a"
            }
        </lang-js>

        <section data-page="svg-xlink-remount-persistence">
            <button id="switch-icon" @click={switchIcon}>Switch icon</button>
            <button id="toggle-show" @click={toggleShow}>Toggle show</button>

            <svg id="svg-root" #if={showSvg} viewBox="0 0 40 40" width="40" height="40">
                <defs>
                    <g id="shape-a"><circle cx="20" cy="20" r="8"></circle></g>
                    <g id="shape-b"><rect x="10" y="10" width="20" height="20"></rect></g>
                </defs>

                <use id="icon-use" !xlink:href={iconHref}></use>
            </svg>

            <p id="state-href">Href: {iconHref}</p>
            <p id="state-show">Show: {showSvg ? "yes" : "no"}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("keeps dynamic xlink state after svg unmount and remount", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#switch-icon").click()
        await expect(page.locator("#state-href")).toHaveText("Href: #shape-b")

        await page.locator("#toggle-show").click()
        await expect(page.locator("#state-show")).toHaveText("Show: no")
        await expect(page.locator("#svg-root")).toHaveCount(0)

        await page.locator("#toggle-show").click()
        await expect(page.locator("#state-show")).toHaveText("Show: yes")

        const hrefAfterRemount = await page
            .locator("#icon-use")
            .evaluate(node => node.getAttributeNS("http://www.w3.org/1999/xlink", "href"))
        expect(hrefAfterRemount).toBe("#shape-b")
    })
})
