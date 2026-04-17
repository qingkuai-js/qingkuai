import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let onceCount = 0
            let stopCount = 0
            let selfCount = 0
            let parentCount = 0
            let submitCount = 0

            const incOnce = () => {
                onceCount++ 
            }

            const incStop = () => {
                stopCount++ 
            }

            const incParent = () => {
                parentCount++ 
            }

            const incSelf = () => {
                selfCount++ 
            }

            const incSubmit = () => {
                submitCount++ 
            }
        </lang-js>

        <section data-page="event-binding-modifiers">
            <button
                id="once-btn"
                @click|once={incOnce()}
            >
                Once
            </button>
            <p id="once-count">{onceCount}</p>

            <div
                id="stop-parent"
                @click={incParent}
            >
                <button
                    id="stop-btn"
                    @click|stop={incStop()}
                >
                    Stop
                </button>
            </div>
            <p id="stop-count">{stopCount}</p>
            <p id="parent-count">{parentCount}</p>

            <form
                id="prevent-form"
                @submit|prevent={incSubmit()}
            >
                <button
                    type="submit"
                    id="submit-btn"
                >
                    Submit
                </button>
            </form>
            <p id="submit-count">{submitCount}</p>

            <div
                id="self-div"
                @click|self={incSelf()}
            >
                <button id="self-inner-btn">Inner</button>
            </div>
            <p id="self-count">{selfCount}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("once modifier fires handler only once", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#once-btn").click()
        await expect(page.locator("#once-count")).toHaveText("1")

        await page.locator("#once-btn").click()
        await page.locator("#once-btn").click()
        await expect(page.locator("#once-count")).toHaveText("1")
    })

    test("stop modifier prevents event propagation to parent", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#stop-btn").click()
        await expect(page.locator("#stop-count")).toHaveText("1")
        await expect(page.locator("#parent-count")).toHaveText("0")

        await page.locator("#stop-parent").click()
        await expect(page.locator("#parent-count")).toHaveText("1")
    })

    test("prevent modifier prevents default form submission", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#submit-btn").click()
        await expect(page.locator("#submit-count")).toHaveText("1")
        await expect(page.locator("[data-page='event-binding-modifiers']")).toBeVisible()
    })

    test("self modifier only fires when target is the element itself", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#self-inner-btn").click()
        await expect(page.locator("#self-count")).toHaveText("0")
    })
})
