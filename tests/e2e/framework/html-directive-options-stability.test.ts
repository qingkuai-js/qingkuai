import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            const stableOptions = {}
            let htmlOptions = stableOptions
            let rawHtml = '<input id="html-stable-input" />'

            const reuseSameOptions = () => {
                htmlOptions = stableOptions
            }

            const useEquivalentNewOptions = () => {
                htmlOptions = {}
            }
        </lang-js>

        <section data-page="html-directive-options-stability">
            <h1 id="html-title">Html directive</h1>
            <button id="reuse-same-options" @click={reuseSameOptions}>Reuse same options</button>
            <button id="new-options-clone" @click={useEquivalentNewOptions}>New options clone</button>
            <div id="html-host" #html={htmlOptions}>{rawHtml}</div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("keeps html subtree when options reference stays unchanged", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const input = page.locator("#html-stable-input")
        await input.fill("typed-value")

        await page.locator("#reuse-same-options").click()
        await expect(input).toHaveValue("typed-value")
    })

    test("recreates html subtree when options reference changes", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const input = page.locator("#html-stable-input")
        await input.fill("typed-value")

        await page.locator("#new-options-clone").click()
        await expect(page.locator("#html-stable-input")).toHaveValue("")
    })
})
