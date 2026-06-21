import type { Page } from "@playwright/test"
import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import MultiRootComp from "./components/scope/MultiRootComp"
            import ToggleScope from "./components/scope/ToggleScope"
            import ListScope from "./components/scope/ListScope"

            let showScoped = true
            let items = [
                { id: 1, label: "Alpha" },
                { id: 2, label: "Beta" }
            ]
            let toggleCount = 0

            const toggle = () => {
                showScoped = !showScoped
                toggleCount++
            }

            const addItem = () => {
                items = [...items, { id: items.length + 1, label: "Item " + (items.length + 1) }]
            }
        </lang-js>

        <section data-page="component-scope-advanced-multi-root">
            <h1 id="multi-root-title">Advanced scope: multi-root and dynamics</h1>

            <section id="multi-root-section">
                <h2>Multi root</h2>
            </section>

            <section id="toggle-section">
                <h2>Toggle</h2>
                <button id="btn-toggle" @click={toggle}>Toggle scope</button>
                <span id="toggle-count">{toggleCount}</span>
            </section>

            <section id="list-section">
                <h2>List</h2>
                <button id="btn-add-item" @click={addItem}>Add item</button>
            </section>
        </section>

        <MultiRootComp #scope />

        <ToggleScope #if={showScoped} #scope />

        <div #for={item of items} #key={item.id}>
            <ListScope #scope !label={item.label} />
        </div>
    `,
    components: {
        "scope/MultiRootComp": `
            <header id="multi-root-header">
                <span id="multi-root-header-inner">header content</span>
            </header>
            <main id="multi-root-main">
                <span id="multi-root-main-inner">main content</span>
            </main>
            text between
            <footer id="multi-root-footer">
                <span id="multi-root-footer-inner">footer content</span>
            </footer>
        `,
        "scope/ToggleScope": `
            <article id="toggle-root">
                <span id="toggle-inner">toggle content</span>
            </article>
        `,
        "scope/ListScope": `
            <article id="list-scope-root">
                <span id="list-scope-inner">item: {props.label}</span>
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

    test("applies ancestor scope to all root elements in multi-root component", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await expect(page.locator("#multi-root-title")).toBeVisible()

        const headerAttrs = await getScopeAttrs(page, "#multi-root-header")
        const mainAttrs = await getScopeAttrs(page, "#multi-root-main")
        const footerAttrs = await getScopeAttrs(page, "#multi-root-footer")
        const headerInnerAttrs = await getScopeAttrs(page, "#multi-root-header-inner")
        const mainInnerAttrs = await getScopeAttrs(page, "#multi-root-main-inner")

        // All root elements should have page scope = 1
        expect(headerAttrs.length).toBe(1)
        expect(mainAttrs.length).toBe(1)
        expect(footerAttrs.length).toBe(1)

        // Inner elements should have no scope = 0
        expect(headerInnerAttrs.length).toBe(0)
        expect(mainInnerAttrs.length).toBe(0)

        // All root elements should share the same scope attributes
        expect(headerAttrs.sort()).toEqual(mainAttrs.sort())
        expect(headerAttrs.sort()).toEqual(footerAttrs.sort())
    })

    test("re-render preserves scope attributes on #scope component", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await expect(page.locator("#multi-root-title")).toBeVisible()

        // Initial: page scope only = 1
        const initialAttrs = await getScopeAttrs(page, "#toggle-root")
        expect(initialAttrs.length).toBe(1)

        // Toggle off (removes ToggleScope, re-renders)
        await page.locator("#btn-toggle").click()
        await expect(page.locator("#toggle-count")).toHaveText("1")

        // Toggle on again
        await page.locator("#btn-toggle").click()
        await expect(page.locator("#toggle-count")).toHaveText("2")

        // After re-render, scope should still be present
        const reRenderedAttrs = await getScopeAttrs(page, "#toggle-root")
        expect(reRenderedAttrs.length).toBe(1)
        expect(reRenderedAttrs).toEqual(initialAttrs)
    })

    test("each iteration in #for gets correct scope attributes", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await expect(page.locator("#multi-root-title")).toBeVisible()

        const allRoots = page.locator('[id="list-scope-root"]')
        await expect(allRoots).toHaveCount(2)

        // Each item's root: ancestor scope only = 1
        for (let i = 0; i < 2; i++) {
            const attrs = await allRoots.nth(i).evaluate(node => {
                return node.getAttributeNames().filter(name => name.startsWith("qk-"))
            })
            expect(attrs.length).toBe(1)
            expect(attrs[0]).toMatch(/^qk-[a-f0-9]+$/)
        }

        // Add a new item
        await page.locator("#btn-add-item").click()
        await expect(allRoots).toHaveCount(3)

        // New item should also have correct scope
        for (let i = 0; i < 3; i++) {
            const attrs = await allRoots.nth(i).evaluate(node => {
                return node.getAttributeNames().filter(name => name.startsWith("qk-"))
            })
            expect(attrs.length).toBe(1)
        }
    })
})
