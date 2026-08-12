import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let outerTarget = null
            let innerTarget = null

            const moveOuterToA = () => {
                outerTarget = "#nested-dest-a"
            }

            const moveInnerToB = () => {
                innerTarget = "#nested-dest-b"
            }

            const resetOuter = () => {
                outerTarget = null
            }

            const resetInner = () => {
                innerTarget = null
            }
        </lang-js>

        <section data-page="target-directive-nested">
            <h1 id="target-title">Nested target directive</h1>
            <div>
                <button id="nested-outer-to-a" @click={moveOuterToA}>Outer to A</button>
                <button id="nested-inner-to-b" @click={moveInnerToB}>Inner to B</button>
                <button id="nested-outer-reset" @click={resetOuter}>Outer reset</button>
                <button id="nested-inner-reset" @click={resetInner}>Inner reset</button>
            </div>
            <div id="nested-source" #target={outerTarget}>
                <p id="nested-inner" #target={innerTarget}>Nested payload</p>
            </div>
            <div id="nested-dest-a"></div>
            <div id="nested-dest-b"></div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("renders nested target content inline initially", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#nested-source #nested-inner")).toHaveText("Nested payload")
        await expect(page.locator("#nested-dest-a #nested-inner")).toHaveCount(0)
        await expect(page.locator("#nested-dest-b #nested-inner")).toHaveCount(0)
    })

    test("moves inner target independently while outer stays inline", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#nested-inner-to-b").click()
        await expect(page.locator("#nested-dest-b #nested-inner")).toHaveText("Nested payload")
        await expect(page.locator("#nested-source #nested-inner")).toHaveCount(0)

        await page.locator("#nested-outer-to-a").click()
        await expect(page.locator("#nested-dest-a #nested-source")).toHaveCount(1)
        await expect(page.locator("#nested-dest-a #nested-inner")).toHaveCount(0)
        await expect(page.locator("#nested-dest-b #nested-inner")).toHaveText("Nested payload")
    })

    test("moves outer target and carries inner content when inner is inline", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#nested-outer-to-a").click()
        await expect(page.locator("#nested-dest-a #nested-source")).toHaveCount(1)
        await expect(page.locator("#nested-dest-a #nested-inner")).toHaveText("Nested payload")
    })

    test("resets outer and inner targets independently", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#nested-outer-to-a").click()
        await expect(page.locator("#nested-dest-a #nested-inner")).toHaveText("Nested payload")

        await page.locator("#nested-inner-to-b").click()
        await expect(page.locator("#nested-dest-b #nested-inner")).toHaveText("Nested payload")
        await expect(page.locator("#nested-dest-a #nested-inner")).toHaveCount(0)

        await page.locator("#nested-inner-reset").click()
        await expect(page.locator("#nested-dest-a #nested-inner")).toHaveText("Nested payload")

        await page.locator("#nested-outer-reset").click()
        await expect(page.locator("#nested-source #nested-inner")).toHaveText("Nested payload")
    })
})
