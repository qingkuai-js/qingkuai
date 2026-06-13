import type { Page } from "@playwright/test"
import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import ScopedChild from "./components/scope/ScopedChild"
            import PlainChild from "./components/scope/PlainChild"
            import NoStyleChild from "./components/scope/NoStyleChild"
        </lang-js>

        <lang-css>
            .scope-inherit {
                outline: 3px solid rgb(255, 0, 0);
            }
        </lang-css>

        <section data-page="component-scope-directive">
            <h1 id="scope-title">Scope directive</h1>

            <ScopedChild #scope />
            <PlainChild />
            <NoStyleChild #scope />
        </section>
    `,
    components: {
        "scope/ScopedChild": `
            <lang-css>
                .child-local {
                    padding: 2px;
                }
            </lang-css>

            <article
                id="scoped-child-root"
                class="scope-inherit child-local"
            >
                <span
                    id="scoped-child-inner"
                    class="scope-inherit"
                >
                    scoped child inner
                </span>
            </article>
        `,
        "scope/PlainChild": `
            <article
                id="plain-child-root"
                class="scope-inherit"
            >
                plain child root
            </article>
        `,
        "scope/NoStyleChild": `
            <article
                id="no-style-child-root"
                class="scope-inherit"
            >
                <span
                    id="no-style-child-inner"
                    class="scope-inherit"
                >
                    no style child inner
                </span>
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

    test("applies parent scope attribute only to #scope component root", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page).toHaveTitle("component-scope-directive")
        await expect(page.locator("#scope-title")).toHaveText("Scope directive")

        const scopedChildRootAttrs = await getScopeAttrs(page, "#scoped-child-root")
        const scopedChildInnerAttrs = await getScopeAttrs(page, "#scoped-child-inner")
        const plainChildRootAttrs = await getScopeAttrs(page, "#plain-child-root")

        expect(scopedChildRootAttrs.length).toBe(scopedChildInnerAttrs.length + 1)
        expect(plainChildRootAttrs).toEqual([])
    })

    test("keeps #scope working for child components without embedded styles", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const noStyleRootAttrs = await getScopeAttrs(page, "#no-style-child-root")
        const noStyleInnerAttrs = await getScopeAttrs(page, "#no-style-child-inner")

        expect(noStyleRootAttrs.length).toBe(1)
        expect(noStyleInnerAttrs).toEqual([])
        expect(noStyleRootAttrs[0]).toMatch(/^qk-[a-f0-9]+$/)
    })
})
