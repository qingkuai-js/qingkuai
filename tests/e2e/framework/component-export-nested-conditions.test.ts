import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import Counter from "./components/export/Counter"

            let level1 = true
            let level2 = true
            let level3 = true
            let counterHandle = null

            const toggleLevel = (level) => {
                if (level === 1) level1 = !level1
                if (level === 2) level2 = !level2
                if (level === 3) level3 = !level3
            }

            const getStatus = () => {
                return \`L1:\${level1 ? "on" : "off"} | L2:\${level2 ? "on" : "off"} | L3:\${level3 ? "on" : "off"}\`
            }

            const increment = () => {
                if (counterHandle) {
                    counterHandle.increment()
                }
            }
        </lang-js>

        <section data-page="component-export-nested-conditions">
            <p id="status">{getStatus()}</p>

            <button id="btn-l1" @click={toggleLevel(1)}>Toggle L1</button>
            <button id="btn-l2" @click={toggleLevel(2)}>Toggle L2</button>
            <button id="btn-l3" @click={toggleLevel(3)}>Toggle L3</button>
            <button id="btn-inc" @click={increment}>Increment</button>

            <div #if={level1} class="level-1">
                <p id="level1-text">Level 1 active</p>

                <div #if={level2} class="level-2">
                    <p id="level2-text">Level 2 active</p>

                    <div #if={level3} class="level-3">
                        <p id="level3-text">Level 3 active</p>
                        <Counter &handle={counterHandle} />
                    </div>
                </div>
            </div>
        </section>
    `,
    components: {
        "export/Counter": `
            <lang-js>
                export let count = reactive(0)

                function increment() {
                    count++
                }

                export { increment }
            </lang-js>

            <div class="nested-counter">
                <p id="counter-display">Count: {count}</p>
            </div>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("export binding works with multiple levels of nested conditionals", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#level1-text")).toBeVisible()
        await expect(page.locator("#level2-text")).toBeVisible()
        await expect(page.locator("#level3-text")).toBeVisible()
        await expect(page.locator(".nested-counter")).toBeVisible()

        await page.locator("#btn-inc").click()
        await expect(page.locator("#counter-display")).toHaveText("Count: 1")

        await page.locator("#btn-inc").click()
        await page.locator("#btn-inc").click()
        await expect(page.locator("#counter-display")).toHaveText("Count: 3")
    })

    test("disabling intermediate level unmounts nested component", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#btn-inc").click()
        await expect(page.locator("#counter-display")).toHaveText("Count: 1")

        await page.locator("#btn-l2").click()
        await expect(page.locator("#level2-text")).toHaveCount(0)
        await expect(page.locator(".nested-counter")).toHaveCount(0)
        await expect(page.locator("#status")).toHaveText("L1:on | L2:off | L3:on")

        await page.locator("#btn-inc").click()

        await page.locator("#btn-l2").click()
        await expect(page.locator("#level2-text")).toBeVisible()
        await expect(page.locator(".nested-counter")).toBeVisible()
        await expect(page.locator("#counter-display")).toHaveText("Count: 0")
    })

    test("disabling deepest level unmounts component directly", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#btn-inc").click()
        await page.locator("#btn-inc").click()
        await expect(page.locator("#counter-display")).toHaveText("Count: 2")

        await page.locator("#btn-l3").click()
        await expect(page.locator("#level3-text")).toHaveCount(0)
        await expect(page.locator(".nested-counter")).toHaveCount(0)

        await expect(page.locator("#level1-text")).toBeVisible()
        await expect(page.locator("#level2-text")).toBeVisible()

        await page.locator("#btn-l3").click()
        await expect(page.locator(".nested-counter")).toBeVisible()
        await expect(page.locator("#counter-display")).toHaveText("Count: 0")
    })

    test("recursive enable/disable through multiple levels", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        for (let cycle = 0; cycle < 2; cycle++) {
            for (let level = 3; level >= 1; level--) {
                await page.locator(`#btn-l${level}`).click()
                await expect(page.locator(`#level${level}-text`)).toHaveCount(0)
            }

            await expect(page.locator(".nested-counter")).toHaveCount(0)

            for (let level = 1; level <= 3; level++) {
                await page.locator(`#btn-l${level}`).click()
                if (level < 3) {
                    await expect(page.locator(`#level${level}-text`)).toBeVisible()
                }
            }

            await expect(page.locator(".nested-counter")).toBeVisible()
            await expect(page.locator("#counter-display")).toHaveText("Count: 0")
        }
    })

    test("handle binding survives conditional re-renders without remount", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#btn-inc").click()
        await page.locator("#btn-inc").click()
        await expect(page.locator("#counter-display")).toHaveText("Count: 2")

        await expect(page.locator("#counter-display")).toHaveText("Count: 2")

        await page.locator("#btn-inc").click()
        await expect(page.locator("#counter-display")).toHaveText("Count: 3")
    })
})
