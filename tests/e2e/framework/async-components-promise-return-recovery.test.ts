import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"
import { formatSourceCode } from "../../../src/util/shared/sundry"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import AsyncOne from "./components/AsyncOne"

            let asyncComponentPromise = new Promise(() => {})

            async function getComponent() {
                await new Promise(resolve => setTimeout(resolve, 20))
                return AsyncOne
            }

            const loadOne = () => (asyncComponentPromise = getComponent())
            const failOne = () => {
                asyncComponentPromise = new Promise((_, reject) => {
                    setTimeout(() => reject("promise failed"), 5)
                })
            }
        </lang-js>

        <section data-page="async-components-promise-return-recovery">
            <button id="load-one" @click={loadOne()}>Load one</button>
            <button id="fail-one" @click={failOne()}>Fail one</button>

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
        AsyncOne: formatSourceCode(`<article id="async-one">Async One</article>`)
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
        await expect(page.locator("#async-one")).toHaveText("Async One")
    })
})
