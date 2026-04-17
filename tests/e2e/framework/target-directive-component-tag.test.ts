import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import TargetPanel from "./components/TargetPanel"

            let componentTagTarget = null

            const moveComponentTagToA = () => {
                componentTagTarget = "#target-dest-a"
            }

            const resetComponentTagInline = () => {
                componentTagTarget = null
            }
        </lang-js>

        <section data-page="target-directive-component-tag">
            <h1 id="target-title">Target directive</h1>
            <div>
                <button id="target-component-tag-to-a" @click={moveComponentTagToA}>Component tag to A</button>
                <button id="target-component-tag-reset" @click={resetComponentTagInline}>Component tag reset</button>
            </div>
            <div id="target-component-tag-source">
                <TargetPanel #target={componentTagTarget}>
                    <span id="target-component-tag-content">Component tag payload</span>
                </TargetPanel>
            </div>
            <div id="target-dest-a"></div>
        </section>
    `,
    components: {
        TargetPanel: `
            <article class="target-panel">
                <slot></slot>
            </article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports target directive on component tag syntax", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(
            page.locator("#target-component-tag-source #target-component-tag-content")
        ).toHaveText("Component tag payload")

        await page.locator("#target-component-tag-to-a").click()
        await expect(page.locator("#target-component-tag-content")).toHaveCount(1)

        await page.locator("#target-component-tag-reset").click()
        await expect(
            page.locator("#target-component-tag-source #target-component-tag-content")
        ).toHaveCount(1)
    })
})
