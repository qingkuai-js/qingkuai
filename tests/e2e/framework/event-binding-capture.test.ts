import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let order = ""

            const push = label => {
                order = order ? order + ">" + label : label
            }

            const onCapture = event => {
                push("capture:" + event.eventPhase)
            }

            const onTarget = event => {
                push("target:" + event.eventPhase)
            }

            const onBubble = event => {
                push("bubble:" + event.eventPhase)
            }
        </lang-js>

        <section data-page="event-binding-capture">
            <div
                id="capture-wrap"
                @click|capture={onCapture}
            >
                <div
                    id="bubble-wrap"
                    @click={onBubble}
                >
                    <button
                        id="target-btn"
                        @click={onTarget}
                    >
                        Click
                    </button>
                </div>
            </div>
            <p id="order">{order}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("capture and bubble phases execute in correct order", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#target-btn").click()
        await expect(page.locator("#order")).toHaveText("capture:1>target:2>bubble:3")
    })
})
