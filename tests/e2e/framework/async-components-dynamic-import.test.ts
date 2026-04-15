import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"
import { formatSourceCode } from "../../../src/util/shared/sundry"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            const createPendingPromise = () => new Promise(() => {})

            let asyncComponentPromise = createPendingPromise()

            const loadAsyncOne = () => {
                asyncComponentPromise = import("./components/AsyncOne")
            }

            const loadAsyncTwo = () => {
                asyncComponentPromise = import("./components/AsyncTwo")
            }

            const failAsyncComponent = () => {
                asyncComponentPromise = new Promise((_, reject) => {
                    setTimeout(() => reject("load failed"), 10)
                })
            }
        </lang-js>

        <section data-page="async-components-dynamic-import">
            <h1 id="async-components-title">Async Components Dynamic Import</h1>

            <div>
                <button id="async-load-one" @click={loadAsyncOne()}>Load component one</button>
                <button id="async-load-two" @click={loadAsyncTwo()}>Load component two</button>
                <button id="async-fail" @click={failAsyncComponent()}>Fail component</button>
            </div>

            <div
                id="async-loading"
                #await={asyncComponentPromise}
            >
                Loading async component...
            </div>
            <qk:spread #then={LoadedComponentModule}>
                <LoadedComponentModule.default />
            </qk:spread>
            <div id="async-error" #catch={err}>Failed: {err}</div>
        </section>
    `,
    components: {
        AsyncOne: formatSourceCode(`
            <article id="async-one">Async One</article>
        `),
        AsyncTwo: formatSourceCode(`
            <article id="async-two">Async Two</article>
        `)
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports dynamic import loading and then render", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page).toHaveTitle("async-components-dynamic-import")
        await expect(page.locator("#async-loading")).toHaveText("Loading async component...")
        await expect(page.locator("#async-one")).toHaveCount(0)
        await expect(page.locator("#async-two")).toHaveCount(0)
        await expect(page.locator("#async-error")).toHaveCount(0)

        await page.locator("#async-load-one").click()
        await expect(page.locator("#async-one")).toHaveText("Async One")
        await expect(page.locator("#async-loading")).toHaveCount(0)
        await expect(page.locator("#async-error")).toHaveCount(0)
    })

    test("supports dynamic import switching and catch", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#async-load-two").click()
        await expect(page.locator("#async-two")).toHaveText("Async Two")
        await expect(page.locator("#async-one")).toHaveCount(0)

        await page.locator("#async-fail").click()
        await expect(page.locator("#async-error")).toHaveText("Failed: load failed")
    })
})
