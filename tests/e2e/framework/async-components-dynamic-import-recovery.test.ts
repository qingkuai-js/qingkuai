import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"
import { formatSourceCode } from "../../../src/util/shared/sundry"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            const createPendingPromise = () => new Promise(() => {})
            let asyncComponentPromise = createPendingPromise()

            const loadMissing = () => {
                asyncComponentPromise = import("./components/MissingAsync")
            }

            const loadOne = () => {
                asyncComponentPromise = new Promise(resolve => {
                    setTimeout(() => resolve(import("./components/AsyncOne")), 20)
                })
            }
        </lang-js>

        <section data-page="async-components-dynamic-import-recovery">
            <button id="load-missing" @click={loadMissing()}>Load missing</button>
            <button id="load-one" @click={loadOne()}>Load one</button>
            
            <div
                id="async-loading"
                #await={asyncComponentPromise}
            >
                Loading...
            </div>
            <qk:spread #then={LoadedComponentModule}>
                <LoadedComponentModule.default />
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
    test("recovers from real dynamic import failure", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#load-missing").click()
        await expect(page.locator("#async-error")).toContainText("Failed:")

        await page.locator("#load-one").click()
        await expect(page.locator("#async-loading")).toHaveText("Loading...")
        await expect(page.locator("#async-error")).toHaveCount(0)
        await expect(page.locator("#async-one")).toHaveText("Async One")
    })
})
