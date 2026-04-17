import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let rawHtml = '<strong id="html-strong">Hello Html</strong>'
            let spreadHtml = '<b id="html-spread-inner">Spread html</b>'

            const setUpdatedHtml = () => {
                rawHtml = '<em id="html-em">Updated Html</em>'
            }

            const setSpreadUpdated = () => {
                spreadHtml = '<u id="html-spread-updated">Spread updated</u>'
            }
        </lang-js>

        <section data-page="html-directive-basic">
            <h1 id="html-title">Html directive</h1>

            <button
                id="html-set-updated"
                @click={setUpdatedHtml}
            >
                Set updated html
            </button>
            <div
                id="html-host"
                #html
            >
                {rawHtml}
            </div>

            <button
                id="html-spread-updated"
                @click={setSpreadUpdated}
            >
                Spread updated
            </button>
            <div id="html-spread-host">
                <qk:spread #html>{spreadHtml}</qk:spread>
            </div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("renders html content and updates when source changes", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page).toHaveTitle("html-directive-basic")
        await expect(page.locator("#html-title")).toHaveText("Html directive")
        await expect(page.locator("#html-host #html-strong")).toHaveText("Hello Html")
        await expect(page.locator("#html-host #html-em")).toHaveCount(0)

        await page.locator("#html-set-updated").click()
        await expect(page.locator("#html-host #html-em")).toHaveText("Updated Html")
        await expect(page.locator("#html-host #html-strong")).toHaveCount(0)
    })

    test("supports html directive on qk spread", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#html-spread-host #html-spread-inner")).toHaveText("Spread html")
        await expect(page.locator("#html-spread-host #html-spread-updated")).toHaveCount(0)

        await page.locator("#html-spread-updated").click()
        await expect(page.locator("#html-spread-host #html-spread-updated")).toHaveText(
            "Spread updated"
        )
        await expect(page.locator("#html-spread-host #html-spread-inner")).toHaveCount(0)
    })
})
