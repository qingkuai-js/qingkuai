import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import AsyncOne from "./components/AsyncOne"

            let resolveLoadOne = () => {}
            let asyncComponentPromise = new Promise(() => {})

            const finishLoadOne = () => resolveLoadOne()

            const loadOne = () => {
                asyncComponentPromise = new Promise(resolve => {
                    resolveLoadOne = () => resolve(AsyncOne)
                })
            }

            const failOne = () => {
                asyncComponentPromise = new Promise((_, reject) => {
                    setTimeout(() => reject("promise failed"), 5)
                })
            }
        </lang-js>

        <section data-page="async-components-promise-return-recovery">
            <button id="load-one" @click={loadOne}>Load one</button>
            <button id="finish-one" @click={finishLoadOne}>Finish one</button>
            <button id="fail-one" @click={failOne}>Fail one</button>

            <div
                id="async-loading"
                #await={asyncComponentPromise}
            >
                Loading...
            </div>
            <qk:spread #then={LoadedComponent}>
                <LoadedComponent />
            </qk:spread>
            <div
                id="async-error"
                #catch={err}
            >
                Failed: {err}
            </div>
        </section>
    `,
    components: {
        AsyncOne: `<article id="async-one">Async One</article>`
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("returns to pending and recovers after rejection", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#fail-one").click()
        await expect(page.locator("#async-error")).toHaveText("Failed: promise failed")

        await page.locator("#load-one").click()
        await expect(page.locator("#async-loading")).toHaveText("Loading...")
        await expect(page.locator("#async-error")).toHaveCount(0)

        await page.locator("#finish-one").click()
        await expect(page.locator("#async-one")).toHaveText("Async One")
        await expect(page.locator("#async-loading")).toHaveCount(0)
    })
})
