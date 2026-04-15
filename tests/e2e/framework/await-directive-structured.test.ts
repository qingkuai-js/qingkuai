import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            const createPendingPromise = () => new Promise(() => {})

            let structuredPromise = createPendingPromise()

            const resetStructured = () => {
                structuredPromise = createPendingPromise()
            }

            const resolveStructured = () => {
                structuredPromise = new Promise(resolve => {
                    setTimeout(() => resolve({ id: 12, name: "Structured" }), 10)
                })
            }

            const rejectStructured = () => {
                structuredPromise = new Promise((_, reject) => {
                    setTimeout(() => reject({ msg: "structured failed", code: 418 }), 10)
                })
            }
        </lang-js>

        <section data-page="await-directive-structured">
            <h1 id="await-title">Await directive</h1>

            <div>
                <button
                    id="structured-reset"
                    @click={resetStructured()}
                >
                    Reset structured
                </button>
                <button
                    id="structured-resolve"
                    @click={resolveStructured()}
                >
                    Resolve structured
                </button>
                <button
                    id="structured-reject"
                    @click={rejectStructured()}
                >
                    Reject structured
                </button>
            </div>
            <div id="structured-block">
                <div
                    id="structured-await"
                    #await={structuredPromise}
                >
                    Structured waiting
                </div>
                <div #then={{ id: resolvedId, name: resolvedName }}>
                    Structured resolved
                    <span id="structured-then-id">{resolvedId}</span>
                    <strong id="structured-then-name">{resolvedName}</strong>
                </div>
                <div #catch={{ msg, code }}>
                    <span id="structured-catch-msg">{msg}</span>
                    Structured rejected
                    <strong id="structured-catch-code">{code}</strong>
                </div>
            </div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports then and catch destructuring with multi-child rendering", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#structured-resolve").click()
        await expect(page.locator("#structured-then-id")).toHaveText("12")

        await page.locator("#structured-reset").click()
        await page.locator("#structured-reject").click()
        await expect(page.locator("#structured-catch-msg")).toHaveText("structured failed")
    })
})
