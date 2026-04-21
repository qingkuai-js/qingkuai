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

        <section data-page="svg-use-href-compat">
            <svg id="svg-root" viewBox="0 0 40 40" width="40" height="40">
                <defs>
                    <g id="shape-a"><circle cx="20" cy="20" r="8"></circle></g>
                    <g id="shape-b"><rect x="10" y="10" width="20" height="20"></rect></g>
                </defs>

                <use id="icon-use" !href={iconHref}></use>
            </svg>

            <button id="switch-icon" @click={switchIcon}>Switch icon</button>
            <p id="state-href">Href: {iconHref}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("updates use href attribute with dynamic !href binding", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const hrefInitial = await page
            .locator("#icon-use")
            .evaluate(node => node.getAttribute("href"))
        expect(hrefInitial).toBe("#shape-a")

        await page.locator("#switch-icon").click()
        await expect(page.locator("#state-href")).toHaveText("Href: #shape-b")

        const hrefAfterSwitch = await page
            .locator("#icon-use")
            .evaluate(node => node.getAttribute("href"))
        expect(hrefAfterSwitch).toBe("#shape-b")
    })
})
