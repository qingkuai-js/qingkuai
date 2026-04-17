import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import ParentComponent from "./components/AsyncParent"
            import ChildComponent from "./components/AsyncChild"

            const createDeferred = () => {
                const handlers = {
                    resolve: () => {},
                    reject: () => {}
                }
                const promise = new Promise((resolve, reject) => {
                    handlers.resolve = resolve
                    handlers.reject = reject
                })
                return { handlers, promise }
            }

            const parentDeferred = createDeferred()
            const childDeferred = createDeferred()

            let parentPromise = parentDeferred.promise
            let childPromise = childDeferred.promise

            const loadParent = () => {
                parentDeferred.handlers.resolve(ParentComponent)
            }

            const loadChild = () => {
                childDeferred.handlers.resolve(ChildComponent)
            }
        </lang-js>

        <section data-page="async-components-nested">
            <div>
                <button id="load-parent" @click={loadParent}>Load Parent</button>
                <button id="load-child" @click={loadChild}>Load Child</button>
            </div>

            <div id="parent-loading" #await={parentPromise}>
                <p>Loading parent component...</p>
            </div>
            <qk:spread #then={ParentMod}>
                <ParentMod>
                    <div id="child-slot">
                        <div id="child-loading" #await={childPromise}>
                            <p>Loading child component in slot...</p>
                        </div>
                        <qk:spread #then={ChildMod}>
                            <ChildMod />
                        </qk:spread>
                    </div>
                </ParentMod>
            </qk:spread>
        </section>
    `,
    components: {
        AsyncParent: `
            <article id="parent-content" class="parent">
                <h2>Parent Component</h2>
                <div id="parent-slot">
                    <slot></slot>
                </div>
            </article>
        `,
        AsyncChild: `
            <div id="child-content" class="child">
                <p>Child Component</p>
            </div>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports nested async component loading", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#parent-loading")).toContainText("Loading parent component...")
        await expect(page.locator("#parent-content")).toHaveCount(0)

        await page.locator("#load-parent").click()
        await expect(page.locator("#parent-content")).toBeVisible()
        await expect(page.locator("#parent-loading")).toHaveCount(0)

        await expect(page.locator("#child-loading")).toContainText(
            "Loading child component in slot..."
        )
        await expect(page.locator("#child-content")).toHaveCount(0)

        await page.locator("#load-child").click()
        await expect(page.locator("#child-content")).toBeVisible()
        await expect(page.locator("#child-loading")).toHaveCount(0)
    })
})
