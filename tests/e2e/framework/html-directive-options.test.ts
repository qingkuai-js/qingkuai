import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let rawHtml = '<strong id="html-strong">Hello Html</strong>'
            let htmlOptions = {}

            const setInitialHtml = () => {
                rawHtml = '<strong id="html-strong">Hello Html</strong>'
            }

            const setUpdatedHtml = () => {
                rawHtml = '<em id="html-em">Updated Html</em>'
            }

            const setScriptHtml = () => {
                rawHtml = '<script id="html-script">window.__qk_html_test__ = 1</script><p id="html-p">Script tail</p>'
            }

            const useNoEscape = () => {
                htmlOptions = {}
            }

            const useEscapeScript = () => {
                htmlOptions = { escapeScript: true }
            }
        </lang-js>

        <section data-page="html-directive-options">
            <h1 id="html-title">Html directive</h1>
            <div>
                <button id="html-set-initial" @click={setInitialHtml}>Set initial html</button>
                <button id="html-set-updated" @click={setUpdatedHtml}>Set updated html</button>
                <button id="html-set-script" @click={setScriptHtml}>Set script html</button>
                <button id="html-escape-none" @click={useNoEscape}>No escape</button>
                <button id="html-escape-script" @click={useEscapeScript}>Escape script</button>
            </div>
            <div id="html-host" #html={htmlOptions}>{rawHtml}</div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports escapeScript option", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#html-set-script").click()
        await expect(page.locator("#html-host script")).toHaveCount(1)
        await expect(page.locator("#html-host #html-p")).toHaveText("Script tail")

        await page.locator("#html-escape-script").click()
        await expect(page.locator("#html-host script")).toHaveCount(0)
        await expect(page.locator("#html-host")).toContainText("window.__qk_html_test__ = 1")
        await expect(page.locator("#html-host #html-p")).toHaveText("Script tail")
    })

    test("compares source-driven updates and options-driven updates", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#html-escape-none").click()
        await page.locator("#html-set-initial").click()
        await expect(page.locator("#html-host #html-strong")).toHaveText("Hello Html")

        await page.locator("#html-set-updated").click()
        await expect(page.locator("#html-host #html-em")).toHaveText("Updated Html")

        await page.locator("#html-escape-none").click()
        await page.locator("#html-set-script").click()
        await expect(page.locator("#html-host script")).toHaveCount(1)

        await page.locator("#html-escape-script").click()
        await expect(page.locator("#html-host script")).toHaveCount(0)
    })
})
