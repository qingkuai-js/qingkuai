import type { Page } from "@playwright/test"
import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

// 多级嵌套，每层根节点均为组件标签且都使用 #scope
// Deeply nested components where each level's root is a component tag with #scope
const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import DeepLevel1 from "./components/scope/DeepLevel1"
        </lang-js>

        <section data-page="component-scope-deep-chain">
            <h1 id="deep-chain-title">Deep scope chain</h1>
        </section>

        <DeepLevel1 #scope />
    `,
    components: {
        "scope/DeepLevel1": `
            <lang-js>
                import DeepLevel2 from "./DeepLevel2"
            </lang-js>

            <DeepLevel2 #scope />
        `,
        "scope/DeepLevel2": `
            <lang-js>
                import DeepLeaf from "./DeepLeaf"
            </lang-js>

            <DeepLeaf #scope />
        `,
        "scope/DeepLeaf": `
            <article id="deep-leaf-root">
                <span id="deep-leaf-inner">deep leaf content</span>
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

    test("each #scope level in a component-tag-root chain adds one scope id", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await expect(page.locator("#deep-chain-title")).toBeVisible()

        const leafRootAttrs = await getScopeAttrs(page, "#deep-leaf-root")
        const leafInnerAttrs = await getScopeAttrs(page, "#deep-leaf-inner")

        expect(leafRootAttrs.length).toBe(3)
        expect(leafInnerAttrs.length).toBe(0)

        const unique = new Set(leafRootAttrs)
        expect(unique.size).toBe(3)
    })
})
