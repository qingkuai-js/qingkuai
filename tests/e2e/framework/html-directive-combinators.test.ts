import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let showIfHtml = true
            let ifHtml = '<i id="html-if-inner">If html</i>'

            const toggleIfHtml = () => {
                showIfHtml = !showIfHtml
            }

            const setIfUpdated = () => {
                ifHtml = '<i id="html-if-inner">If html updated</i>'
            }
        </lang-js>

        <section data-page="html-directive-combinators">
            <h1 id="html-title">Html directive</h1>
            <div>
                <button id="html-if-toggle" @click={toggleIfHtml()}>Toggle html if</button>
                <button id="html-if-updated" @click={setIfUpdated()}>If updated</button>
            </div>
            <div id="html-if-host">
                <div id="html-if-block" #if={showIfHtml} #html>{ifHtml}</div>
            </div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports html directive combined with if", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#html-if-host #html-if-inner")).toHaveText("If html")

        await page.locator("#html-if-updated").click()
        await expect(page.locator("#html-if-host #html-if-inner")).toHaveText("If html updated")

        await page.locator("#html-if-toggle").click()
        await expect(page.locator("#html-if-host #html-if-block")).toHaveCount(0)

        await page.locator("#html-if-toggle").click()
        await expect(page.locator("#html-if-host #html-if-inner")).toHaveText("If html updated")
    })
})
