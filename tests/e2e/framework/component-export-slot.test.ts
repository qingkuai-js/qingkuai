import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import Wrapper from "./components/export/Wrapper"
            import Counter from "./components/export/Counter"

            let counterHandle = null
            let slotContent = "counter"

            const toggleSlot = () => {
                slotContent = slotContent === "counter" ? "empty" : "counter"
            }

            const callIncrement = () => {
                if (counterHandle) {
                    counterHandle.increment()
                }
            }
        </lang-js>

        <section data-page="component-export-slot">
            <p id="slot-mode">Slot mode: {slotContent}</p>
            <button id="btn-toggle-slot" @click={toggleSlot}>Toggle slot</button>
            <button id="btn-increment" @click={callIncrement}>Increment via handle</button>

            <Wrapper>
                <div id="slot-body">
                    <div #if={slotContent === "counter"}>
                        <Counter &handle={counterHandle} />
                    </div>
                    <div #if={slotContent === "empty"}>
                        <p id="empty-slot">Empty slot content</p>
                    </div>
                </div>
            </Wrapper>
        </section>
    `,
    components: {
        "export/Wrapper": `
            <div class="wrapper-component">
                <p id="wrapper-label">Wrapper</p>
                <slot></slot>
            </div>
        `,
        "export/Counter": `
            <lang-js>
                export let count = reactive(0)

                function increment() {
                    count++
                }

                export { increment }
            </lang-js>

            <div class="counter-in-slot">
                <p id="counter-value">Count: {count}</p>
                <button id="counter-btn" @click={increment}>+1</button>
            </div>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("export binding works for components in slot", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator(".counter-in-slot")).toBeVisible()
        await expect(page.locator("#counter-value")).toHaveText("Count: 0")

        await page.locator("#btn-increment").click()
        await expect(page.locator("#counter-value")).toHaveText("Count: 1")

        await page.locator("#counter-btn").click()
        await expect(page.locator("#counter-value")).toHaveText("Count: 2")
    })

    test("switching slot content unmounts and remounts components", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator(".counter-in-slot")).toBeVisible()
        await page.locator("#counter-btn").click()
        await expect(page.locator("#counter-value")).toHaveText("Count: 1")

        await page.locator("#btn-toggle-slot").click()
        await expect(page.locator("#slot-mode")).toHaveText("Slot mode: empty")
        await expect(page.locator(".counter-in-slot")).toHaveCount(0)
        await expect(page.locator("#empty-slot")).toBeVisible()

        await page.locator("#btn-increment").click()

        await page.locator("#btn-toggle-slot").click()
        await expect(page.locator("#slot-mode")).toHaveText("Slot mode: counter")
        await expect(page.locator(".counter-in-slot")).toBeVisible()
        await expect(page.locator("#counter-value")).toHaveText("Count: 0")
    })

    test("handle binding works correctly after multiple slot switches", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        for (let i = 0; i < 3; i++) {
            if (i > 0) {
                await page.locator("#btn-toggle-slot").click()
            }
            await expect(page.locator(".counter-in-slot")).toBeVisible()

            await page.locator("#btn-increment").click()
            await expect(page.locator("#counter-value")).toHaveText("Count: 1")

            await page.locator("#btn-toggle-slot").click()
            await expect(page.locator("#empty-slot")).toBeVisible()

            await page.locator("#btn-increment").click()
        }
    })

    test("preserves export binding state through slot re-renders", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#btn-increment").click()
        await page.locator("#counter-btn").click()
        await page.locator("#btn-increment").click()
        await expect(page.locator("#counter-value")).toHaveText("Count: 3")

        await page.locator("#btn-toggle-slot").click()
        await expect(page.locator("#empty-slot")).toBeVisible()

        await page.locator("#btn-toggle-slot").click()
        await expect(page.locator("#counter-value")).toHaveText("Count: 0")

        await page.locator("#btn-increment").click()
        await page.locator("#btn-increment").click()
        await expect(page.locator("#counter-value")).toHaveText("Count: 2")
    })
})
