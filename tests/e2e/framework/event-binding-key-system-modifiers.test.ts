import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let ctrlCount = 0
            let altCount = 0
            let metaCount = 0

            const incCtrl = () => {
                ctrlCount++
            }

            const incAlt = () => {
                altCount++
            }

            const incMeta = () => {
                metaCount++
            }
        </lang-js>

        <section data-page="event-binding-key-system-modifiers">
            <input
                id="ctrl-input"
                @keydown|ctrl|enter={incCtrl}
            />
            <input
                id="alt-input"
                @keydown|alt|enter={incAlt}
            />
            <input
                id="meta-input"
                @keydown|meta|enter={incMeta}
            />
            <p id="counts">{ctrlCount}-{altCount}-{metaCount}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("ctrl/alt/meta modifiers are respected", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#ctrl-input").press("Control+Enter")
        await page.locator("#alt-input").press("Alt+Enter")
        await page.locator("#meta-input").press("Meta+Enter")

        await expect(page.locator("#counts")).toHaveText("1-1-1")
    })
})
