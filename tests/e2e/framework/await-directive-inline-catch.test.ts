import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            const createPendingPromise = () => new Promise(() => {})
            let inlineRejectPromise = createPendingPromise()

            const resetInlineReject = () => {
                inlineRejectPromise = createPendingPromise()
            }

            const rejectInline = () => {
                inlineRejectPromise = new Promise((_, reject) => {
                    setTimeout(() => reject("inline failed"), 10)
                })
            }
        </lang-js>

        <section data-page="await-directive-inline-catch">
            <h1 id="await-title">Await directive</h1>

            <div>
                <button
                    id="inline-reject-reset"
                    @click={resetInlineReject()}
                >
                    Reset inline reject
                </button>
                <button
                    id="inline-reject-trigger"
                    @click={rejectInline()}
                >
                    Reject inline
                </button>
            </div>
            <div id="inline-reject-block">
                <p
                    id="inline-catch"
                    #await={inlineRejectPromise}
                    #catch={err}
                >
                    Inline rejected: {err}
                </p>
            </div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports same-tag await and catch", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#inline-reject-trigger").click()
        await expect(page.locator("#inline-catch")).toHaveText("Inline rejected: inline failed")
    })
})
