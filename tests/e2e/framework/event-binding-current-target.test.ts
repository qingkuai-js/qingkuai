import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let chain = ""

            const push = (name, id) => {
                chain = chain ? chain + ">" + name + ":" + id : name + ":" + id
            }

            const onCapture = event => {
                push("capture", event.currentTarget.id)
            }

            const onTarget = event => {
                push("target", event.currentTarget.id)
            }

            const onBubble = event => {
                push("bubble", event.currentTarget.id)
            }
        </lang-js>

        <section data-page="event-binding-current-target">
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
            <p id="chain">{chain}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("currentTarget matches executing node", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#target-btn").click()
        await expect(page.locator("#chain")).toHaveText(
            "capture:capture-wrap>target:target-btn>bubble:bubble-wrap"
        )
    })
})
