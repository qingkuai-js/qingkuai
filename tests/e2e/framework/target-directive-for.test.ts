import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let forTarget = null
            let forItems = [
                { id: 1, label: "For A" },
                { id: 2, label: "For B" }
            ]

            const moveForToB = () => {
                forTarget = "#target-dest-b"
            }

            const appendForItem = () => {
                forItems.push({
                    id: forItems.length + 1,
                    label: "For " + String.fromCharCode(64 + forItems.length + 1)
                })
            }
        </lang-js>

        <section data-page="target-directive-for">
            <h1 id="target-title">Target directive</h1>
            <div>
                <button id="target-for-to-b" @click={moveForToB}>For to B</button>
                <button id="target-for-append" @click={appendForItem}>For append</button>
            </div>
            <div id="target-for-source">
                <p #for={item of forItems} #key={item.id}>
                    <span #target={forTarget} class="target-for-item">{item.label}</span>
                </p>
            </div>
            <div id="target-dest-b"></div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports target directive combined with for", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#target-for-to-b").click()
        await expect(page.locator("#target-dest-b .target-for-item")).toHaveCount(2)
        await expect(page.locator("#target-dest-b")).toContainText("For A")
        await expect(page.locator("#target-dest-b")).toContainText("For B")

        await page.locator("#target-for-append").click()
        await expect(page.locator("#target-dest-b .target-for-item")).toHaveCount(3)
        await expect(page.locator("#target-dest-b")).toContainText("For C")
    })
})
