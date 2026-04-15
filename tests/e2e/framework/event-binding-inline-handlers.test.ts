import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let clickCount = 0
            let enterCount = 0
            let lastTargetId = ""
            let argEventType = ""
            let argTargetId = ""
            let argInputValue = ""
        </lang-js>

        <section data-page="event-binding-inline-handlers">
            <button id="inline-btn" @click={clickCount++, argEventType = $arg.type}>Click</button>
            <input id="inline-input" @input={lastTargetId = event.target.id} />
            <input
                id="inline-arg-input"
                @input={argTargetId = $arg.target.id, argInputValue = $arg.target.value}
            />
            <input id="inline-key" @keydown|enter={enterCount++} />
            <p id="click-count">{clickCount}</p>
            <p id="enter-count">{enterCount}</p>
            <p id="target-id">{lastTargetId}</p>
            <p id="arg-type">{argEventType}</p>
            <p id="arg-target-id">{argTargetId}</p>
            <p id="arg-input-value">{argInputValue}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("inline handlers work for click input and key modifiers", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#inline-btn").click()
        await expect(page.locator("#click-count")).toHaveText("1")
        await expect(page.locator("#arg-type")).toHaveText("click")

        await page.locator("#inline-input").fill("abc")
        await expect(page.locator("#target-id")).toHaveText("inline-input")

        await page.locator("#inline-arg-input").fill("xyz")
        await expect(page.locator("#arg-target-id")).toHaveText("inline-arg-input")
        await expect(page.locator("#arg-input-value")).toHaveText("xyz")

        await page.locator("#inline-key").press("Escape")
        await expect(page.locator("#enter-count")).toHaveText("0")

        await page.locator("#inline-key").press("Enter")
        await expect(page.locator("#enter-count")).toHaveText("1")
    })
})
