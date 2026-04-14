import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            const createPendingPromise = () => new Promise(() => {})

            let priorityPromise = createPendingPromise()
            let showPriorityPending = false

            const resetPriority = () => {
                priorityPromise = createPendingPromise()
            }

            const resolvePriority = () => {
                priorityPromise = new Promise(resolve => {
                    setTimeout(() => resolve("priority resolved"), 10)
                })
            }

            const togglePriorityIf = () => {
                showPriorityPending = !showPriorityPending
            }
        </lang-js>

        <section data-page="await-directive-priority">
            <h1 id="await-title">Await directive</h1>

            <div>
                <button
                    id="priority-reset"
                    @click={resetPriority()}
                >
                    Reset priority
                </button>
                <button
                    id="priority-resolve"
                    @click={resolvePriority()}
                >
                    Resolve priority
                </button>
                <button
                    id="priority-toggle-if"
                    @click={togglePriorityIf()}
                >
                    Toggle priority if
                </button>
            </div>
            <div id="priority-block">
                <p
                    id="priority-await"
                    #await={priorityPromise}
                    #if={showPriorityPending}
                >
                    Priority pending
                </p>
                <p
                    id="priority-then"
                    #then={res}
                >
                    Priority then: {res}
                </p>
                <p
                    id="priority-catch"
                    #catch={err}
                >
                    Priority catch: {err}
                </p>
            </div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("await has higher priority than if on the same tag", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#priority-resolve").click()
        await expect(page.locator("#priority-then")).toHaveText("Priority then: priority resolved")

        await page.locator("#priority-reset").click()
        await page.locator("#priority-toggle-if").click()
        await expect(page.locator("#priority-await")).toHaveText("Priority pending")
    })
})
