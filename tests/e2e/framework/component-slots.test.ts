import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import SlotShowcase from "./components/layout/SlotShowcase"
        </lang-js>

        <section data-page="component-slots">
            <h1 id="component-slots-title">Component Slots</h1>

            <SlotShowcase>
                <h2
                    id="slot-header-content"
                    #slot={slotCtx from "header"}
                >
                    {slotCtx.label}
                </h2>
                <p
                    id="slot-default-content"
                    #slot={slotCtx from "default"}
                >
                    Default slot: {slotCtx.kind}
                </p>
            </SlotShowcase>
        </section>
    `,
    components: {
        "layout/SlotShowcase": `
            <section id="slot-showcase">
                <div id="slot-header-host">
                    <slot name="header" !label={"Header from child"}>
                        <span id="slot-header-fallback">Header fallback</span>
                    </slot>
                </div>
                <div id="slot-default-host">
                    <slot !kind={"payload"}>
                        <span id="slot-default-fallback">Default fallback</span>
                    </slot>
                </div>
                <div id="slot-footer-host">
                    <slot name="footer">
                        <span id="slot-footer-fallback">Footer fallback</span>
                    </slot>
                </div>
            </section>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test.describe("component slots case", () => {
        test("supports component slots with props and fallback", async ({
            page,
            visitScenario
        }) => {
            await visitScenario(scenario)

            await expect(page).toHaveTitle("component-slots")
            await expect(page.locator("#component-slots-title")).toHaveText("Component Slots")
            await expect(page.locator("#slot-showcase")).toBeVisible()

            await expect(page.locator("#slot-header-content")).toHaveText("Header from child")
            await expect(page.locator("#slot-default-content")).toHaveText("Default slot: payload")

            await expect(page.locator("#slot-header-fallback")).toHaveCount(0)
            await expect(page.locator("#slot-default-fallback")).toHaveCount(0)
            await expect(page.locator("#slot-footer-fallback")).toHaveText("Footer fallback")
        })
    })
})
