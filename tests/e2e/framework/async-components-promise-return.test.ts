import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import AsyncOne from "./components/AsyncOne"
            import AsyncTwo from "./components/AsyncTwo"

            const createPendingPromise = () => new Promise(() => {})

            let asyncComponentPromise = createPendingPromise()

            async function getComponentModule(componentName) {
                await new Promise(resolve => setTimeout(resolve, 10))
                return componentName === "one" ? AsyncOne : AsyncTwo
            }

            const loadAsyncOne = () => {
                asyncComponentPromise = getComponentModule("one")
            }

            const loadAsyncTwo = () => {
                asyncComponentPromise = getComponentModule("two")
            }

            const failAsyncComponent = () => {
                asyncComponentPromise = new Promise((_, reject) => {
                    setTimeout(() => reject("promise failed"), 10)
                })
            }
        </lang-js>

        <section data-page="async-components-promise-return">
            <h1 id="async-components-title">Async Components Promise Return</h1>

            <button id="async-load-one" @click={loadAsyncOne()}>Load component one</button>
            <button id="async-load-two" @click={loadAsyncTwo()}>Load component two</button>
            <button id="async-fail" @click={failAsyncComponent()}>Fail component</button>

            <div
                id="async-loading"
                #await={asyncComponentPromise}
            >
                Loading async component...
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
        AsyncOne: `
            <article id="async-one">Async One</article>
        `,
        AsyncTwo: `
            <article id="async-two">Async Two</article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports async function returning component module", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page).toHaveTitle("async-components-promise-return")
        await expect(page.locator("#async-loading")).toHaveText("Loading async component...")

        await page.locator("#async-load-one").click()
        await expect(page.locator("#async-one")).toHaveText("Async One")
        await expect(page.locator("#async-loading")).toHaveCount(0)
    })

    test("supports async function switch and rejection", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#async-load-two").click()
        await expect(page.locator("#async-two")).toHaveText("Async Two")
        await expect(page.locator("#async-one")).toHaveCount(0)

        await page.locator("#async-fail").click()
        await expect(page.locator("#async-error")).toHaveText("Failed: promise failed")
    })
})
