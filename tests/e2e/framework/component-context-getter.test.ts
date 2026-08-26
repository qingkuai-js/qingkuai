import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import { getContexts, getCurrentInstance, onAfterMount } from "qingkuai"
            import GetterCard from "./components/GetterCard"
            import GetterBadge from "./components/GetterBadge"
            import GetterList from "./components/GetterList"

            let count = reactive(0)
            let name = reactive("root")

            setContextGetter("count", () => count)
            setContextGetter("name", () => name)

            setContext("plainFn", () => "plain")

            const increment = () => {
                count++
            }

            const rename = () => {
                name = "renamed"
            }

            onAfterMount(() => {
                globalThis.__rootContexts = getContexts(getCurrentInstance())
            })
        </lang-js>

        <section data-page="component-context-getter">
            <h1 id="getter-title">Component Context Getter</h1>

            <p id="root-count">Root count: {contexts.count}</p>
            <p id="root-name">Root name: {contexts.name}</p>
            <p id="root-plain">Root plain: {contexts.plainFn}</p>

            <button id="btn-increment" @click={increment}>Increment</button>
            <button id="btn-rename" @click={rename}>Rename</button>

            <GetterCard />
            <GetterBadge />
            <GetterList />
        </section>
    `,
    components: {
        GetterCard: `
            <lang-js>
                import GetterFooter from "./GetterFooter"
            </lang-js>

            <article id="getter-card">
                <p id="card-count">Card count: {contexts.count}</p>
                <GetterFooter />
            </article>
        `,
        GetterFooter: `
            <p id="footer-count">Footer count: {contexts.count}</p>
            <p id="footer-name">Footer name: {contexts.name}</p>
        `,
        GetterBadge: `
            <lang-js>
                let local = reactive("badge")
                setContextGetter("name", () => local)
            </lang-js>

            <span id="badge-name">Badge name: {contexts.name}</span>
        `,
        GetterList: `
            <lang-js>
                let items = reactive(["a", "b", "c"])
            </lang-js>

            <ul id="getter-list">
                <li #for={item of items} class="getter-item">
                    {item}: {contexts.count}
                </li>
            </ul>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("setContextGetter lazily evaluates and tracks reactive dependencies", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#root-count")).toHaveText("Root count: 0")
        await expect(page.locator("#root-name")).toHaveText("Root name: root")

        // getter 访问响应式变量，变化时 contexts 值更新。
        // The getter reads a reactive variable; the context value updates on change.
        await page.locator("#btn-increment").click()
        await expect(page.locator("#root-count")).toHaveText("Root count: 1")

        await page.locator("#btn-rename").click()
        await expect(page.locator("#root-name")).toHaveText("Root name: renamed")
    })

    test("setContextGetter value is inherited by child and grandchild components", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#card-count")).toHaveText("Card count: 0")
        await expect(page.locator("#footer-count")).toHaveText("Footer count: 0")
        await expect(page.locator("#footer-name")).toHaveText("Footer name: root")

        // 父级响应式值变化，子/孙组件同步更新。
        // Changing the parent reactive value updates child and grandchild.
        await page.locator("#btn-increment").click()
        await expect(page.locator("#card-count")).toHaveText("Card count: 1")
        await expect(page.locator("#footer-count")).toHaveText("Footer count: 1")
    })

    test("child setContextGetter shadows the parent key without affecting it", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#badge-name")).toHaveText("Badge name: badge")
        await expect(page.locator("#root-name")).toHaveText("Root name: root")
        await expect(page.locator("#footer-name")).toHaveText("Footer name: root")

        // 父级响应式值变化不影响被遮蔽的子级。
        // Changing the parent reactive value does not affect the shadowed child.
        await page.locator("#btn-rename").click()
        await expect(page.locator("#root-name")).toHaveText("Root name: renamed")
        await expect(page.locator("#badge-name")).toHaveText("Badge name: badge")
    })

    test("setContext stores a function as-is while setContextGetter invokes it", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        // setContext 存函数值，读取时返回函数本身（typeof 为 function）。
        // setContext stores a function as-is; reading returns the function itself.
        await expect(page.locator("#root-plain")).toHaveText('Root plain: () => "plain"')
    })

    test("contexts are accessible inside a #for loop and stay reactive", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const items = page.locator("#getter-list .getter-item")
        await expect(items).toHaveCount(3)
        await expect(items.nth(0)).toHaveText("a: 0")
        await expect(items.nth(1)).toHaveText("b: 0")
        await expect(items.nth(2)).toHaveText("c: 0")

        // 父级响应式值变化，for 循环内的 contexts 同步更新。
        // Changing the parent reactive value updates contexts inside the for loop.
        await page.locator("#btn-increment").click()
        await expect(items.nth(0)).toHaveText("a: 1")
        await expect(items.nth(1)).toHaveText("b: 1")
        await expect(items.nth(2)).toHaveText("c: 1")
    })

    test("getContexts returns the live contexts object", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        const ctx = await page.evaluate(() => (globalThis as any).__rootContexts)
        expect(ctx).toBeTruthy()
        expect(ctx.count).toBe(0)
        expect(ctx.name).toBe("root")
    })
})
