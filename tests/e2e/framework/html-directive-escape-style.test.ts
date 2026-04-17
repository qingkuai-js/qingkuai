import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let htmlOptions = {}
            let rawHtml = '<style id="html-style">#html-style-tail { color: red; }</style><span id="html-style-tail">Styled tail</span>'

            const useEscapeStyle = () => {
                htmlOptions = { escapeStyle: true }
            }

            const useNoEscape = () => {
                htmlOptions = {}
            }
        </lang-js>

        <section data-page="html-directive-escape-style">
            <h1 id="html-title">Html directive</h1>
            <button id="html-escape-style" @click={useEscapeStyle}>Escape style</button>
            <button id="html-escape-none" @click={useNoEscape}>No escape</button>
            <div id="html-host" #html={htmlOptions}>{rawHtml}</div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports escapeStyle option", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#html-host style#html-style")).toHaveCount(1)
        await expect(page.locator("#html-host #html-style-tail")).toHaveText("Styled tail")

        await page.locator("#html-escape-style").click()
        await expect(page.locator("#html-host style#html-style")).toHaveCount(0)
        await expect(page.locator("#html-host")).toContainText("#html-style-tail")
        await expect(page.locator("#html-host #html-style-tail")).toHaveText("Styled tail")

        await page.locator("#html-escape-none").click()
        await expect(page.locator("#html-host style#html-style")).toHaveCount(1)
    })
})
