import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"
import { formatSourceCode } from "../../../src/util/shared/sundry"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import AsyncOne from "./components/AsyncOne"
            import AsyncTwo from "./components/AsyncTwo"

            let asyncComponentPromise = new Promise(() => {})

            async function getComponent(componentName, delay) {
                await new Promise(resolve => setTimeout(resolve, delay))
                return componentName === "one" ? AsyncOne : AsyncTwo
            }

            const loadSlowOne = () => (asyncComponentPromise = getComponent("one", 40))
            const loadFastTwo = () => (asyncComponentPromise = getComponent("two", 5))
        </lang-js>

        <section data-page="async-components-promise-return-race">
            <button id="load-slow-one" @click={loadSlowOne()}>Load slow one</button>
            <button id="load-fast-two" @click={loadFastTwo()}>Load fast two</button>

            <div
                id="async-loading"
                #await={asyncComponentPromise}
            >
                Loading...
            </div>
            <qk:spread #then={LoadedComponent}>
                <LoadedComponent />
            </qk:spread>
        </section>
    `,
    components: {
        AsyncOne: formatSourceCode(`<article id="async-one">Async One</article>`),
        AsyncTwo: formatSourceCode(`<article id="async-two">Async Two</article>`)
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("ignores stale async function results", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#load-slow-one").click()
        await page.locator("#load-fast-two").click()

        await expect(page.locator("#async-two")).toHaveText("Async Two")
        await expect(page.locator("#async-one")).toHaveCount(0)
        await expect(page.locator("#async-loading")).toHaveCount(0)
    })
})
