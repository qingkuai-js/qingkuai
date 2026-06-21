import type { Page } from "@playwright/test"
import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import ChainBreakMiddle from "./components/scope/ChainBreakMiddle"
            import ChainForwardMiddleRoot from "./components/scope/ChainForwardMiddleRoot"
        </lang-js>

        <section data-page="component-scope-advanced-chain-breaking">
            <h1 id="chain-title">Scope chain breaking</h1>
        </section>

        <ChainBreakMiddle #scope />

        <ChainForwardMiddleRoot #scope />
    `,
    components: {
        "scope/ChainBreakMiddle": `
            <lang-js>
                import LeafNoScope from "./LeafNoScope"
            </lang-js>

            <section>
                <LeafNoScope />
            </section>
        `,
        "scope/ChainForwardMiddleRoot": `
            <lang-js>
                import LeafForwarded from "./LeafForwarded"
            </lang-js>

            <LeafForwarded />
        `,
        "scope/LeafNoScope": `
            <article id="chain-break-leaf">
                <span id="chain-break-leaf-inner">leaf no scope</span>
            </article>
        `,
        "scope/LeafForwarded": `
            <article id="chain-forward-leaf">
                <span id="chain-forward-leaf-inner">leaf forwarded</span>
            </article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    const getScopeAttrs = async (page: Page, selector: string) => {
        return page.locator(selector).evaluate(node => {
            return node.getAttributeNames().filter(name => name.startsWith("qk-"))
        })
    }

    test("scope chain breaks when intermediate component lacks #scope", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await expect(page.locator("#chain-title")).toBeVisible()

        // ChainBreakMiddle has #scope from parent (page component).
        // But ChainBreakMiddle does NOT use #scope on LeafNoScope.
        // So LeafNoScope should NOT inherit page's scope — only its own scope.
        const leafAttrs = await getScopeAttrs(page, "#chain-break-leaf")
        const leafInnerAttrs = await getScopeAttrs(page, "#chain-break-leaf-inner")

        // LeafNoScope has no #scope → no ancestor scopes → 0 scope attrs
        expect(leafAttrs.length).toBe(0)
        expect(leafInnerAttrs.length).toBe(0)
    })

    test("root component tag forwards ancestor scope chain without #scope", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await expect(page.locator("#chain-title")).toBeVisible()

        const leafAttrs = await getScopeAttrs(page, "#chain-forward-leaf")
        const leafInnerAttrs = await getScopeAttrs(page, "#chain-forward-leaf-inner")

        expect(leafAttrs.length).toBe(1)
        expect(leafInnerAttrs.length).toBe(0)
    })
})
