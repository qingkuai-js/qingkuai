import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import FallbackBox from "./components/FallbackBox"
        </lang-js>

        <section data-page="component-slots-fallback-content">
            <div id="fallback-rendered">
                <FallbackBox />
            </div>

            <div id="content-override">
                <FallbackBox>
                    <p class="passed-text">passed content</p>
                </FallbackBox>
            </div>
        </section>
    `,
    components: {
        FallbackBox: `
            <lang-js>
                let fallbackText = reactive("initial fallback")
                const changeFallbackText = () => {
                    fallbackText = "updated fallback"
                }
            </lang-js>

            <div class="fallback-box">
                <slot>
                    <p class="fallback-text">fallback: {fallbackText}</p>
                </slot>
                <button class="change-fallback" @click={changeFallbackText}>change</button>
            </div>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("renders interpolated fallback content on mount", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#fallback-rendered .fallback-text")).toHaveText(
            "fallback: initial fallback"
        )
    })

    test("updates interpolated fallback content reactively", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#fallback-rendered .change-fallback").click()

        await expect(page.locator("#fallback-rendered .fallback-text")).toHaveText(
            "fallback: updated fallback"
        )
    })

    test("prefers passed content over interpolated fallback", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#content-override .passed-text")).toHaveText("passed content")
        await expect(page.locator("#content-override .fallback-text")).toHaveCount(0)
    })
})
