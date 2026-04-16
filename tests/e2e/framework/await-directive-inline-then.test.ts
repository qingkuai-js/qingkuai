import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            const createPendingPromise = () => new Promise(() => {})
            let inlineResolvePromise = createPendingPromise()

            const resetInlineResolve = () => {
                inlineResolvePromise = createPendingPromise()
            }

            const resolveInline = () => {
                inlineResolvePromise = new Promise(resolve => {
                    setTimeout(() => resolve("inline done"), 10)
                })
            }
        </lang-js>

        <section data-page="await-directive-inline-then">
            <h1 id="await-title">Await directive</h1>

            <div>
                <button
                    id="inline-resolve-reset"
                    @click={resetInlineResolve}
                >
                    Reset inline resolve
                </button>
                <button
                    id="inline-resolve-trigger"
                    @click={resolveInline}
                >
                    Resolve inline
                </button>
            </div>
            <div id="inline-order-host">
                <span class="inline-order-marker">Before</span>
                <div id="inline-resolve-block">
                    <p
                        id="inline-then"
                        #await={inlineResolvePromise}
                        #then={res}
                    >
                        Inline resolved: {res}
                    </p>
                </div>
                <span class="inline-order-marker">After</span>
            </div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports same-tag await and then", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#inline-resolve-trigger").click()
        await expect(page.locator("#inline-then")).toHaveText("Inline resolved: inline done")
    })
})
