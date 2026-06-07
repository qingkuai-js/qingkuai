import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import CounterView from "./components/ui/CounterView"
            import BadgeView from "./components/ui/BadgeView"

            let CurrentView = CounterView
            let handle = null
            let snapshot = "none"
            let parentCount = 0

            const switchIdentifierView = () => {
                CurrentView = CurrentView === CounterView ? BadgeView : CounterView
            }

            const increaseParentCount = () => {
                parentCount++
            }

            const snapshotHandle = () => {
                snapshot = handle ? String(handle.value) : "null"
            }

            const pingHandle = () => {
                if (handle) {
                    handle.ping()
                }
            }
        </lang-js>

        <section data-page="component-dynamic-tag-reactivity">
            <h1 id="dynamic-tag-title">Dynamic Component Tag Reactivity</h1>
            <p id="parent-count">Parent count: {parentCount}</p>
            <p id="snapshot">Snapshot: {snapshot}</p>

            <button id="switch-identifier" @click={switchIdentifierView}>Switch identifier view</button>
            <button id="increase-parent" @click={increaseParentCount}>Increase parent count</button>
            <button id="snapshot-handle" @click={snapshotHandle}>Snapshot handle</button>
            <button id="ping-handle" @click={pingHandle}>Ping handle</button>

            <CurrentView id="identifier-view" !count={parentCount} &handle={handle} />
        </section>
    `,
    components: {
        "ui/CounterView": `
            <lang-js>
                export let value = 0

                const ping = () => {
                    value++
                }

                export { ping }
            </lang-js>

            <article id="counter-view" !data-root={props.id}>
                <p class="kind">Kind: counter</p>
                <p class="value">Value: {value}</p>
                <p class="count">Count: {props.count}</p>
            </article>
        `,
        "ui/BadgeView": `
            <lang-js>
                export let value = 10

                const ping = () => {
                    value += 2
                }

                export { ping }
            </lang-js>

            <article id="badge-view" !data-root={props.id}>
                <p class="kind">Kind: badge</p>
                <p class="value">Value: {value}</p>
                <p class="count">Count: {props.count}</p>
            </article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("updates identifier component tag when expression changes", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#counter-view")).toBeVisible()
        await expect(page.locator("#badge-view")).toHaveCount(0)
        await expect(page.locator("#counter-view .count")).toHaveText("Count: 0")

        await page.locator("#switch-identifier").click()
        await expect(page.locator("#badge-view")).toBeVisible()
        await expect(page.locator("#counter-view")).toHaveCount(0)

        await page.locator("#increase-parent").click()
        await expect(page.locator("#parent-count")).toHaveText("Parent count: 1")
        await expect(page.locator("#badge-view .count")).toHaveText("Count: 1")

        await page.locator("#switch-identifier").click()
        await expect(page.locator("#counter-view")).toBeVisible()
        await expect(page.locator("#badge-view")).toHaveCount(0)
        await expect(page.locator("#counter-view .count")).toHaveText("Count: 1")
    })

    test("rebinds exported handle to latest dynamic component instance", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#snapshot-handle").click()
        await expect(page.locator("#snapshot")).toHaveText("Snapshot: 0")

        await page.locator("#ping-handle").click()
        await expect(page.locator("#counter-view .value")).toHaveText("Value: 1")
        await page.locator("#snapshot-handle").click()
        await expect(page.locator("#snapshot")).toHaveText("Snapshot: 1")

        await page.locator("#switch-identifier").click()
        await expect(page.locator("#badge-view")).toBeVisible()

        await page.locator("#snapshot-handle").click()
        await expect(page.locator("#snapshot")).toHaveText("Snapshot: 10")

        await page.locator("#ping-handle").click()
        await expect(page.locator("#badge-view .value")).toHaveText("Value: 12")
        await page.locator("#snapshot-handle").click()
        await expect(page.locator("#snapshot")).toHaveText("Snapshot: 12")

        await page.locator("#switch-identifier").click()
        await expect(page.locator("#counter-view")).toBeVisible()
        await page.locator("#snapshot-handle").click()
        await expect(page.locator("#snapshot")).toHaveText("Snapshot: 0")
    })
})
