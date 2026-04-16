import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import AsyncOne from "./components/AsyncOne"
            import AsyncTwo from "./components/AsyncTwo"

            let raceProbe = "idle"
            let asyncComponentPromise = new Promise(() => {})

            async function getComponent(componentName, delay) {
                await new Promise(resolve => setTimeout(resolve, delay))
                return componentName === "one" ? AsyncOne : AsyncTwo
            }

            const loadSlowOne = () => (asyncComponentPromise = getComponent("one", 40))
            const loadSlowFail = () => {
                raceProbe = "idle"
                asyncComponentPromise = new Promise((_, reject) => {
                    setTimeout(() => {
                        raceProbe = "done"
                        reject("slow failed")
                    }, 40)
                })
            }
            const loadFastTwo = () => (asyncComponentPromise = getComponent("two", 5))
        </lang-js>

        <section data-page="async-components-promise-return-race">
            <button id="load-slow-one" @click={loadSlowOne()}>Load slow one</button>
            <button id="load-slow-fail" @click={loadSlowFail()}>Load slow fail</button>
            <button id="load-fast-two" @click={loadFastTwo()}>Load fast two</button>
            <p id="race-probe">{raceProbe}</p>

            <div
                id="async-loading"
                #await={asyncComponentPromise}
            >
                Loading...
            </div>
            <qk:spread #then={LoadedComponent}>
                <LoadedComponent />
            </qk:spread>
            <div id="async-error" #catch={err}>Failed: {err}</div>
        </section>
    `,
    components: {
        AsyncOne: `<article id="async-one">Async One</article>`,
        AsyncTwo: `<article id="async-two">Async Two</article>`
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

    test("ignores stale rejection after a newer success", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#load-slow-fail").click()
        await page.locator("#load-fast-two").click()

        await expect(page.locator("#async-two")).toHaveText("Async Two")
        await expect(page.locator("#race-probe")).toHaveText("done")
        await expect(page.locator("#async-error")).toHaveCount(0)
        await expect(page.locator("#async-one")).toHaveCount(0)
    })
})
