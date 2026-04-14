import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let htmlOptions = {}
            let rawHtml = '<iframe id="html-frame" src="about:blank"></iframe><span id="html-span">Frame tail</span>'

            const useNoEscape = () => {
                htmlOptions = {}
            }

            const useEscapeIframe = () => {
                htmlOptions = { escapeTags: ["iframe"] }
            }
        </lang-js>

        <section data-page="html-directive-escape-iframe">
            <h1 id="html-title">Html directive</h1>
            <div>
                <button id="html-escape-iframe" @click={useEscapeIframe()}>Escape iframe</button>
                <button id="html-escape-none" @click={useNoEscape()}>No escape</button>
            </div>
            <div id="html-host" #html={htmlOptions}>{rawHtml}</div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports custom escapeTags option", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#html-host iframe#html-frame")).toHaveCount(1)
        await expect(page.locator("#html-host #html-span")).toHaveText("Frame tail")

        await page.locator("#html-escape-iframe").click()
        await expect(page.locator("#html-host iframe#html-frame")).toHaveCount(0)
        await expect(page.locator("#html-host")).toContainText("html-frame")

        await page.locator("#html-escape-none").click()
        await expect(page.locator("#html-host iframe#html-frame")).toHaveCount(1)
    })
})
