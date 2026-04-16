import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import AsyncOne from "./components/AsyncOne"

            const createPendingPromise = () => {
                return new Promise(() => {})
            }

            let renderTarget = null
            let showAsyncHost = true
            let asyncComponentPromise = createPendingPromise()

            const moveToA = () => {
                renderTarget = "#target-dest-a"
            }

            const moveToSource = () => {
                renderTarget = null
            }

            const hideHost = () => {
                showAsyncHost = false
            }

            const showHost = () => {
                showAsyncHost = true
            }

            const resetPending = () => {
                asyncComponentPromise = createPendingPromise()
            }

            const loadOne = () => {
                asyncComponentPromise = new Promise(resolve => {
                    setTimeout(() => resolve(AsyncOne), 10)
                })
            }

            const failLoad = () => {
                asyncComponentPromise = new Promise((_, reject) => {
                    setTimeout(() => reject("load failed"), 10)
                })
            }
        </lang-js>

        <section data-page="async-components-directive-combinators">
            <button id="move-to-a" @click={moveToA()}>Move to A</button>
            <button id="move-to-source" @click={moveToSource()}>Move to source</button>
            <button id="hide-host" @click={hideHost()}>Hide host</button>
            <button id="show-host" @click={showHost()}>Show host</button>
            <button id="reset-pending" @click={resetPending()}>Reset pending</button>
            <button id="load-one" @click={loadOne()}>Load one</button>
            <button id="fail-load" @click={failLoad()}>Fail load</button>

            <div id="target-dest-a"></div>

            <section id="target-source">
                <div id="async-host" #if={showAsyncHost}>
                    <div
                        id="async-loading"
                        #target={renderTarget}
                        #await={asyncComponentPromise}
                    >
                        Loading...
                    </div>
                    <qk:spread
                        #target={renderTarget}
                        #then={LoadedComponent}
                    >
                        <LoadedComponent />
                    </qk:spread>
                    <div
                        id="async-error"
                        #catch={err}
                        #target={renderTarget}
                    >
                        Failed: {err}
                    </div>
                </div>
            </section>
        </section>
    `,
    components: {
        AsyncOne: `<article id="async-one">Async One</article>`
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports target directive combined with async component branches", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#move-to-a").click()
        await expect(page.locator("#target-dest-a #async-loading")).toHaveText("Loading...")

        await page.locator("#load-one").click()
        await expect(page.locator("#target-dest-a #async-one")).toHaveText("Async One")
        await expect(page.locator("#target-dest-a #async-loading")).toHaveCount(0)

        await page.locator("#fail-load").click()
        await expect(page.locator("#target-dest-a #async-error")).toHaveText("Failed: load failed")
        await expect(page.locator("#target-dest-a #async-one")).toHaveCount(0)
    })

    test("supports full pending then catch flow after moving back to source", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#move-to-a").click()
        await expect(page.locator("#target-dest-a #async-loading")).toHaveText("Loading...")

        await page.locator("#move-to-source").click()
        await expect(page.locator("#target-dest-a #async-loading")).toHaveCount(0)
        await expect(page.locator("#target-source #async-loading")).toHaveText("Loading...")

        await page.locator("#load-one").click()
        await expect(page.locator("#target-source #async-one")).toHaveText("Async One")
        await expect(page.locator("#target-dest-a #async-one")).toHaveCount(0)

        await page.locator("#reset-pending").click()
        await expect(page.locator("#target-source #async-loading")).toHaveCount(1)
        await expect(page.locator("#target-source #async-one")).toHaveCount(0)

        await page.locator("#fail-load").click()
        await expect(page.locator("#target-source #async-error")).toHaveText("Failed: load failed")

        await page.locator("#reset-pending").click()
        await expect(page.locator("#target-source #async-loading")).toHaveText("Loading...")
        await expect(page.locator("#target-source #async-error")).toHaveCount(0)

        await page.locator("#load-one").click()
        await expect(page.locator("#target-source #async-one")).toHaveText("Async One")
        await expect(page.locator("#target-source #async-loading")).toHaveCount(0)
    })

    test("supports if directive combined with async component branches", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#target-source #async-loading")).toHaveText("Loading...")

        await page.locator("#hide-host").click()
        await expect(page.locator("#async-host")).toHaveCount(0)
        await expect(page.locator("#target-source #async-loading")).toHaveCount(0)

        await page.locator("#show-host").click()
        await expect(page.locator("#target-source #async-loading")).toHaveText("Loading...")

        await page.locator("#load-one").click()
        await expect(page.locator("#target-source #async-one")).toHaveText("Async One")
        await expect(page.locator("#target-source #async-error")).toHaveCount(0)
    })

    test("cleans moved pending branch on hide and keeps pending unique after reset", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#move-to-a").click()
        await expect(page.locator("#target-dest-a #async-loading")).toHaveText("Loading...")

        await page.locator("#hide-host").click()
        await expect(page.locator("#async-host")).toHaveCount(0)
        await expect(page.locator("#target-dest-a #async-loading")).toHaveCount(0)

        await page.locator("#show-host").click()
        await page.locator("#reset-pending").click()
        await expect(page.locator("#target-dest-a #async-loading")).toHaveCount(1)
        await expect(page.locator("#target-dest-a #async-loading")).toHaveText("Loading...")

        await page.locator("#load-one").click()
        await expect(page.locator("#target-dest-a #async-one")).toHaveText("Async One")
        await expect(page.locator("#target-dest-a #async-one")).toHaveCount(1)
        await expect(page.locator("#target-dest-a #async-loading")).toHaveCount(0)
    })
})
