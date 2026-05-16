import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import Counter from "./components/export/Counter"

            let invokeCount = 0
            let showCounter = true
            let conditionState = "first"
            let handle1 = null
            let handle2 = null
            let snapshot = "none"

            const toggleCounter = () => {
                showCounter = !showCounter
                invokeCount++
            }

            const switchCondition = () => {
                conditionState = conditionState === "first" ? "second" : "first"
            }

            const snapshotHandle1 = () => {
                snapshot = handle1 ? String(handle1.count) : "null"
            }

            const snapshotHandle2 = () => {
                snapshot = handle2 ? String(handle2.count) : "null"
            }

            const incViaHandle1 = () => {
                if (handle1) handle1.increment()
            }

            const incViaHandle2 = () => {
                if (handle2) handle2.increment()
            }
        </lang-js>

        <section data-page="component-export-directive-reinvoke">
            <p id="invoke-count">Invoke count: {invokeCount}</p>
            <p id="condition-state">Condition: {conditionState}</p>
            <p id="snapshot">Snapshot: {snapshot}</p>

            <button id="btn-toggle" @click={toggleCounter}>Toggle counter</button>
            <button id="btn-switch" @click={switchCondition}>Switch condition</button>
            <button id="btn-snap-1" @click={snapshotHandle1}>Snapshot handle 1</button>
            <button id="btn-snap-2" @click={snapshotHandle2}>Snapshot handle 2</button>
            <button id="btn-inc-1" @click={incViaHandle1}>Inc via handle 1</button>
            <button id="btn-inc-2" @click={incViaHandle2}>Inc via handle 2</button>

            <div #if={conditionState === "first" && showCounter}>
                <Counter id="counter-1" &handle={handle1} />
            </div>

            <div #if={conditionState === "second" && showCounter}>
                <Counter id="counter-2" &handle={handle2} />
            </div>

            <p id="toggle-result">Toggled {invokeCount} times</p>
        </section>
    `,
    components: {
        "export/Counter": `
            <lang-js>
                export let count = 0

                function increment() {
                    count++
                }

                export { increment }
            </lang-js>

            <article !id={props.id} class="counter-component">
                <p class="counter-value">Count: {count}</p>
                <button class="btn-increment" @click={increment}>+1</button>
            </article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("handle is cleared on unmount and restored to fresh instance on remount", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#counter-1")).toBeVisible()

        // increment via DOM, verify handle reflects current count
        await page.locator("#counter-1 .btn-increment").click()
        await page.locator("#btn-snap-1").click()
        await expect(page.locator("#snapshot")).toHaveText("Snapshot: 1")

        // toggle off — handle should be cleared
        await page.locator("#btn-toggle").click()
        await expect(page.locator("#counter-1")).toHaveCount(0)
        await page.locator("#btn-snap-1").click()
        await expect(page.locator("#snapshot")).toHaveText("Snapshot: null")

        // toggle on — new instance, handle restored with fresh count
        await page.locator("#btn-toggle").click()
        await expect(page.locator("#counter-1")).toBeVisible()
        await page.locator("#btn-snap-1").click()
        await expect(page.locator("#snapshot")).toHaveText("Snapshot: 0")

        // increment via handle on new instance
        await page.locator("#btn-inc-1").click()
        await expect(page.locator("#counter-1 .counter-value")).toHaveText("Count: 1")
    })

    test("switching between conditional branches assigns handles to correct instances", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#counter-1")).toBeVisible()
        await page.locator("#btn-inc-1").click()
        await page.locator("#btn-snap-1").click()
        await expect(page.locator("#snapshot")).toHaveText("Snapshot: 1")

        // switch to second branch — counter-1 unmounts, counter-2 mounts
        await page.locator("#btn-switch").click()
        await expect(page.locator("#condition-state")).toHaveText("Condition: second")
        await expect(page.locator("#counter-1")).toHaveCount(0)
        await expect(page.locator("#counter-2")).toBeVisible()

        // handle1 cleared, handle2 is fresh instance
        await page.locator("#btn-snap-1").click()
        await expect(page.locator("#snapshot")).toHaveText("Snapshot: null")
        await page.locator("#btn-snap-2").click()
        await expect(page.locator("#snapshot")).toHaveText("Snapshot: 0")

        // increment counter-2 via handle
        await page.locator("#btn-inc-2").click()
        await page.locator("#btn-inc-2").click()
        await expect(page.locator("#counter-2 .counter-value")).toHaveText("Count: 2")

        // switch back — counter-1 remounts (fresh), counter-2 unmounts
        await page.locator("#btn-switch").click()
        await expect(page.locator("#counter-1")).toBeVisible()
        await expect(page.locator("#counter-2")).toHaveCount(0)

        // handle1 restored with fresh count, handle2 cleared
        await page.locator("#btn-snap-1").click()
        await expect(page.locator("#snapshot")).toHaveText("Snapshot: 0")
        await page.locator("#btn-snap-2").click()
        await expect(page.locator("#snapshot")).toHaveText("Snapshot: null")
    })

    test("repeated mount/unmount cycles always yield fresh handle with correct currentInstance", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        for (let i = 0; i < 3; i++) {
            await expect(page.locator("#counter-1")).toBeVisible()

            // increment via handle, verify DOM
            await page.locator("#btn-inc-1").click()
            await expect(page.locator("#counter-1 .counter-value")).toHaveText("Count: 1")
            await page.locator("#btn-snap-1").click()
            await expect(page.locator("#snapshot")).toHaveText("Snapshot: 1")

            // toggle off — handle cleared
            await page.locator("#btn-toggle").click()
            await expect(page.locator("#counter-1")).toHaveCount(0)
            await page.locator("#btn-snap-1").click()
            await expect(page.locator("#snapshot")).toHaveText("Snapshot: null")

            // toggle on — fresh instance, count reset to 0
            await page.locator("#btn-toggle").click()
            await expect(page.locator("#counter-1")).toBeVisible()
            await expect(page.locator("#counter-1 .counter-value")).toHaveText("Count: 0")
        }

        await expect(page.locator("#invoke-count")).toHaveText("Invoke count: 6")
    })
})
