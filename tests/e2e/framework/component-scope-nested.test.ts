import type { Page } from "@playwright/test"
import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import MiddleComponent from "./components/scope/MiddleComponent"
        </lang-js>

        <section data-page="component-scope-nested">
            <h1 id="nested-scope-title">Nested scope directive</h1>
        </section>

        <MiddleComponent #scope />
    `,
    components: {
        "scope/MiddleComponent": `
            <lang-js>
                import LeafComponent from "./LeafComponent"
            </lang-js>

            <LeafComponent #scope />
        `,
        "scope/LeafComponent": `
            <article
                id="leaf-root"
                class="grandparent-style middle-style leaf-style"
            >
                <span id="leaf-inner">leaf content</span>
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

    test("propagates all ancestor scope attributes to nested #scope component root", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page).toHaveTitle("component-scope-nested")
        await expect(page.locator("#nested-scope-title")).toHaveText("Nested scope directive")

        const leafRootAttrs = await getScopeAttrs(page, "#leaf-root")
        const leafInnerAttrs = await getScopeAttrs(page, "#leaf-inner")

        // 叶组件的根元素应该有 2 个 scope 属性（grandparent + middle）
        // Leaf component's root should have 2 scope attrs (grandparent + middle)
        expect(leafRootAttrs.length).toBe(2)
        // 内部元素无 scope
        // Inner elements have no scope
        expect(leafInnerAttrs.length).toBe(0)

        // 验证所有 scope 属性格式正确
        // Verify all scope attribute formats are correct
        for (const attr of leafRootAttrs) {
            expect(attr).toMatch(/^qk-[a-f0-9]+$/)
        }
    })
})
