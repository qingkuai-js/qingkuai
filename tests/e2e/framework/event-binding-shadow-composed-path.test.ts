import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let hostCount = 0
            let parentCount = 0

            const incHost = () => {
                hostCount++
            }

            const incParent = () => {
                parentCount++
            }
        </lang-js>

        <section data-page="event-binding-shadow-composed-path">
            <div
                id="parent"
                @click={incParent}
            >
                <div
                    id="host"
                    @click={incHost}
                ></div>
            </div>
            <p id="counts">{hostCount}-{parentCount}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("delegation works with shadow composedPath", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.evaluate(() => {
            const host = document.querySelector("#host") as HTMLElement
            const root = host.attachShadow({ mode: "open" })
            const button = document.createElement("button")
            button.id = "shadow-btn"
            button.textContent = "Shadow"
            root.append(button)

            const shadowButton = host.shadowRoot!.querySelector("#shadow-btn") as HTMLButtonElement
            shadowButton.click()
        })

        await expect(page.locator("#counts")).toHaveText("1-1")
    })
})
