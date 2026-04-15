import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            const createPendingPromise = () => new Promise(() => {})

            let spreadPromise = createPendingPromise()

            const resetSpread = () => {
                spreadPromise = createPendingPromise()
            }

            const resolveSpread = () => {
                spreadPromise = new Promise(resolve => {
                    setTimeout(() => resolve({ label: "Spread resolved", extra: "OK" }), 10)
                })
            }

            const rejectSpread = () => {
                spreadPromise = new Promise((_, reject) => {
                    setTimeout(() => reject({ msg: "spread failed", code: 503 }), 10)
                })
            }
        </lang-js>

        <section data-page="await-directive-spread">
            <h1 id="await-title">Await directive</h1>

            <div>
                <button
                    id="spread-reset"
                    @click={resetSpread()}
                >
                    Reset spread
                </button>
                <button
                    id="spread-resolve"
                    @click={resolveSpread()}
                >
                    Resolve spread
                </button>
                <button
                    id="spread-reject"
                    @click={rejectSpread()}
                >
                    Reject spread
                </button>
            </div>
            <div id="spread-block">
                <qk:spread #await={spreadPromise}>
                    Spread waiting
                    <span id="spread-await-copy">Spread pending</span>
                </qk:spread>
                <qk:spread #then={{ label, extra }}>
                    Spread then text
                    <span id="spread-then-label">{label}</span>
                    <strong id="spread-then-extra">{extra}</strong>
                </qk:spread>
                <qk:spread #catch={{ msg, code }}>
                    <span id="spread-catch-msg">{msg}</span>
                    Spread catch text
                    <strong id="spread-catch-code">{code}</strong>
                </qk:spread>
            </div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports qk spread await then catch with multi-child and text-node content", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#spread-await-copy")).toHaveText("Spread pending")

        await page.locator("#spread-resolve").click()
        await expect(page.locator("#spread-then-label")).toHaveText("Spread resolved")

        await page.locator("#spread-reset").click()
        await page.locator("#spread-reject").click()
        await expect(page.locator("#spread-catch-msg")).toHaveText("spread failed")
    })
})
