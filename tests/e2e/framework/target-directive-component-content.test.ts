import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import TargetPanel from "./components/TargetPanel"

            let componentTarget = null

            const moveComponentToB = () => {
                componentTarget = "#target-dest-b"
            }

            const resetComponentInline = () => {
                componentTarget = null
            }
        </lang-js>

        <section data-page="target-directive-component-content">
            <h1 id="target-title">Target directive</h1>
            <div>
                <button id="target-component-to-b" @click={moveComponentToB()}>Component to B</button>
                <button id="target-component-reset" @click={resetComponentInline()}>Component reset</button>
            </div>
            <div id="target-component-source">
                <div #target={componentTarget}>
                    <TargetPanel>
                        <span id="target-component-content">Component payload</span>
                    </TargetPanel>
                </div>
            </div>
            <div id="target-dest-b"></div>
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
    test("supports target directive with component content", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#target-component-source #target-component-content")).toHaveText(
            "Component payload"
        )

        await page.locator("#target-component-to-b").click()
        await expect(page.locator("#target-dest-b #target-component-content")).toHaveText(
            "Component payload"
        )
        await expect(
            page.locator("#target-component-source #target-component-content")
        ).toHaveCount(0)

        await page.locator("#target-component-reset").click()
        await expect(page.locator("#target-component-source #target-component-content")).toHaveText(
            "Component payload"
        )
    })
})
