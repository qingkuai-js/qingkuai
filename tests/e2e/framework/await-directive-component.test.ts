import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import AsyncPanel from "./components/AsyncPanel"

            const createPendingPromise = () => new Promise(() => {})
            let componentPromise = createPendingPromise()

            const resetComponentPromise = () => {
                componentPromise = createPendingPromise()
            }

            const resolveComponentPromise = () => {
                componentPromise = new Promise(resolve => {
                    setTimeout(() => resolve("component resolved"), 10)
                })
            }

            const rejectComponentPromise = () => {
                componentPromise = new Promise((_, reject) => {
                    setTimeout(() => reject("component failed"), 10)
                })
            }
        </lang-js>

        <section data-page="await-directive-component">
            <h1 id="await-title">Await directive</h1>

            <div>
                <button
                    id="component-await-reset"
                    @click={resetComponentPromise()}
                >
                    Reset component await
                </button>
                <button
                    id="component-await-resolve"
                    @click={resolveComponentPromise()}
                >
                    Resolve component await
                </button>
                <button
                    id="component-await-reject"
                    @click={rejectComponentPromise()}
                >
                    Reject component await
                </button>
            </div>
            <div id="component-await-order-host">
                <span class="component-await-marker">Before</span>
                <AsyncPanel #await={componentPromise}>
                    <span id="component-await-pending">Component pending</span>
                </AsyncPanel>
                <AsyncPanel #then={res}>
                    <span id="component-await-then">Component then: {res}</span>
                </AsyncPanel>
                <AsyncPanel #catch={err}>
                    <span id="component-await-catch">Component catch: {err}</span>
                </AsyncPanel>
                <span class="component-await-marker">After</span>
            </div>
        </section>
    `,
    components: {
        AsyncPanel: `
            <article class="component-await-panel">
                <slot></slot>
            </article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("keeps component await branches between stable siblings", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const children = page.locator("#component-await-order-host > *")
        await expect(children).toHaveText(["Before", "Component pending", "After"])

        await page.locator("#component-await-resolve").click()
        await expect(children).toHaveText(["Before", "Component then: component resolved", "After"])

        await page.locator("#component-await-reset").click()
        await page.locator("#component-await-reject").click()
        await expect(children).toHaveText(["Before", "Component catch: component failed", "After"])
    })
})
