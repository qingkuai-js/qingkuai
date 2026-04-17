import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import SlotPanel from "./components/layout/SlotPanel"
        </lang-js>

        <section data-page="component-slots-advanced">
            <SlotPanel>
                <qk:spread #slot={{ label } from "header"}>
                    <h2 class="header-content">{label}</h2>
                </qk:spread>

                <qk:spread>
                    <p class="default-content">Filled default content</p>
                </qk:spread>

                <qk:spread #slot={"footer"}>
                    <p class="footer-content">Filled footer content</p>
                </qk:spread>
            </SlotPanel>

            <SlotPanel>
                <qk:spread #slot={{ label } from "header"}>
                    <h2 class="header-only-content">{label}</h2>
                </qk:spread>
            </SlotPanel>
        </section>
    `,
    components: {
        "layout/SlotPanel": `
            <section class="slot-panel">
                <header class="slot-header-host">
                    <slot name="header" !label={"Header from child"}>
                        <span class="header-fallback">Header fallback</span>
                    </slot>
                </header>

                <main class="slot-default-host">
                    <slot>
                        <span class="default-fallback">Default fallback</span>
                    </slot>
                </main>

                <footer class="slot-footer-host" #if={slots.footer}>
                    <slot name="footer"></slot>
                </footer>
            </section>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports slot context destructuring", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator(".slot-panel").nth(0).locator(".header-content")).toHaveText(
            "Header from child"
        )
        await expect(page.locator(".slot-panel").nth(1).locator(".header-only-content")).toHaveText(
            "Header from child"
        )
    })

    test("supports qk spread slot rendering", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        const firstPanel = page.locator(".slot-panel").nth(0)
        await expect(firstPanel.locator(".default-content")).toHaveText("Filled default content")
        await expect(firstPanel.locator(".footer-content")).toHaveText("Filled footer content")
    })

    test("renders default slot fallback when default content is missing", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const secondPanel = page.locator(".slot-panel").nth(1)
        await expect(secondPanel.locator(".default-fallback")).toHaveText("Default fallback")
    })

    test("renders slot presence branches based on passed named slots", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const firstPanel = page.locator(".slot-panel").nth(0)
        const secondPanel = page.locator(".slot-panel").nth(1)

        await expect(firstPanel.locator(".slot-footer-host")).toHaveCount(1)
        await expect(firstPanel.locator(".footer-content")).toHaveText("Filled footer content")
        await expect(secondPanel.locator(".slot-footer-host")).toHaveCount(0)
    })
})
