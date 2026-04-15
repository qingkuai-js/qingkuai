import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import AsyncOne from "./components/AsyncOne"
            import AsyncTwo from "./components/AsyncTwo"

            let asyncComponentPromise = new Promise(() => {})

            const loadSlowOne = () => {
                asyncComponentPromise = new Promise(resolve => {
                    setTimeout(() => resolve(AsyncOne), 40)
                })
            }

            const loadFastTwo = () => {
                asyncComponentPromise = new Promise(resolve => {
                    setTimeout(() => resolve(AsyncTwo), 5)
                })
            }
        </lang-js>

        <section data-page="async-components-dynamic-import-race">
            <button id="load-slow-one" @click={loadSlowOne()}>Load slow one</button>
            <button id="load-fast-two" @click={loadFastTwo()}>Load fast two</button>

            <div
                id="async-loading"
                #await={asyncComponentPromise}
            >
                Loading...
            </div>
            <qk:spread #then={LoadedComponentModule}>
                <LoadedComponentModule />
            </qk:spread>
        </section>
    `,
    components: {
        AsyncOne: `<article id="async-one">Async One</article>`,
        AsyncTwo: `<article id="async-two">Async Two</article>`
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("ignores stale dynamic import results", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#load-slow-one").click()
        await page.locator("#load-fast-two").click()

        await expect(page.locator("#async-two")).toHaveText("Async Two")
        await expect(page.locator("#async-one")).toHaveCount(0)
        await expect(page.locator("#async-loading")).toHaveCount(0)
    })
})
