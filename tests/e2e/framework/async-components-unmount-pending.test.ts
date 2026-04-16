import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import AsyncOne from "./components/AsyncOne"

            let showHost = true
            let resolveCurrentPromise = () => {}
            let resolveCount = 0

            const createPendingPromise = () => {
                return new Promise(resolve => {
                    resolveCurrentPromise = () => {
                        resolveCount += 1
                        resolve(AsyncOne)
                    }
                })
            }

            let asyncComponentPromise = createPendingPromise()

            const reloadPending = () => {
                asyncComponentPromise = createPendingPromise()
            }

            const hideHost = () => {
                showHost = false
            }

            const resolvePending = () => {
                resolveCurrentPromise()
            }
        </lang-js>

        <section data-page="async-components-unmount-pending">
            <button id="reload-pending" @click={reloadPending()}>Reload pending</button>
            <button id="hide-host" @click={hideHost()}>Hide host</button>
            <button id="resolve-pending" @click={resolvePending()}>Resolve pending</button>

            <p id="host-state">{showHost ? "shown" : "hidden"}</p>
            <p id="resolve-count">{resolveCount}</p>

            <section id="async-host" #if={showHost}>
                <div id="async-loading" #await={asyncComponentPromise}>Loading...</div>
                <qk:spread #then={LoadedComponent}>
                    <LoadedComponent />
                </qk:spread>
                <div id="async-error" #catch={err}>Failed: {err}</div>
            </section>
        </section>
    `,
    components: {
        AsyncOne: `<article id="async-one">Async One</article>`
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("does not render stale async result after host unmount", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#host-state")).toHaveText("shown")
        await expect(page.locator("#async-loading")).toHaveText("Loading...")

        await page.locator("#reload-pending").click()
        await page.locator("#hide-host").click()
        await expect(page.locator("#host-state")).toHaveText("hidden")
        await expect(page.locator("#async-host")).toHaveCount(0)

        await page.locator("#resolve-pending").click()
        await expect(page.locator("#resolve-count")).toHaveText("1")
        await expect(page.locator("#async-one")).toHaveCount(0)
    })
})
