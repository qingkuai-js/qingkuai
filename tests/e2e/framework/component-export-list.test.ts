import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import Counter from "./components/export/Counter"

            let items = reactive([
                {
                    id: 1,
                    handle: null,
                    label: "Item 1"
                },
                {
                    id: 2,
                    handle: null,
                    label: "Item 2"
                },
                {
                    id: 3,
                    handle: null,
                    label: "Item 3"
                }
            ])

            const incrementCounter = (id) => {
                const item = items.find(item => item.id === id)
                if (item?.handle) {
                    item.handle.increment()
                }
            }

            const getCounterValue = (id) => {
                const item = items.find(item => item.id === id)
                return "Counter " + id + ": " + (item?.handle ? item.handle.count : "null")
            }

            const removeItem = (id) => {
                const index = items.findIndex(item => item.id === id)
                if (index > -1) {
                    items.splice(index, 1)
                }
            }

            const addItem = () => {
                const newId = Math.max(...items.map(i => i.id)) + 1
                items.push({
                    id: newId,
                    handle: null,
                    label: "Item " + newId
                })
            }
        </lang-js>

        <section data-page="component-export-list">
            <button id="btn-add" @click={addItem}>Add item</button>

            <div id="counters">
                <div
                    #for={item of items}
                    #key={item.id}
                    class="counter-row"
                >
                    <span class="label">{item.label}</span>
                    <Counter !id={"counter-" + item.id} &handle={item.handle} />
                    <button !id={"btn-inc-" + item.id} @click={() => incrementCounter(item.id)}>Inc</button>
                    <span !id={"value-" + item.id} class="value">{getCounterValue(item.id)}</span>
                    <button !id={"btn-remove-" + item.id} @click={() => removeItem(item.id)}>Remove</button>
                </div>
            </div>
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

            <div !id={props.id} class="counter">
                <p class="counter-display">Value: {count}</p>
            </div>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("export binding works independently for each item in list", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#value-1")).toHaveText("Counter 1: 0")
        await expect(page.locator("#value-2")).toHaveText("Counter 2: 0")
        await expect(page.locator("#value-3")).toHaveText("Counter 3: 0")

        await page.locator("#btn-inc-1").click()
        await page.locator("#btn-inc-1").click()
        await expect(page.locator("#value-1")).toHaveText("Counter 1: 2")
        await expect(page.locator("#counter-1 .counter-display")).toHaveText("Value: 2")

        await page.locator("#btn-inc-2").click()
        await expect(page.locator("#value-2")).toHaveText("Counter 2: 1")
        await expect(page.locator("#counter-2 .counter-display")).toHaveText("Value: 1")

        await expect(page.locator("#value-3")).toHaveText("Counter 3: 0")
        await expect(page.locator("#counter-3 .counter-display")).toHaveText("Value: 0")
    })

    test("removing item from list properly cleans up component instance", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#btn-inc-1").click()
        await page.locator("#btn-inc-2").click()
        await page.locator("#btn-inc-2").click()
        await page.locator("#btn-inc-3").click()

        await expect(page.locator("#value-1")).toHaveText("Counter 1: 1")
        await expect(page.locator("#value-2")).toHaveText("Counter 2: 2")
        await expect(page.locator("#value-3")).toHaveText("Counter 3: 1")

        await page.locator("#btn-remove-2").click()
        await expect(page.locator("#counter-2")).toHaveCount(0)
        await expect(page.locator("#value-2")).toHaveCount(0)

        await page.locator("#btn-inc-1").click()
        await expect(page.locator("#value-1")).toHaveText("Counter 1: 2")

        await page.locator("#btn-inc-3").click()
        await expect(page.locator("#value-3")).toHaveText("Counter 3: 2")
    })

    test("adding new item to list creates independent component instance", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator(".counter-row")).toHaveCount(3)

        await page.locator("#btn-inc-1").click()
        await page.locator("#btn-inc-2").click()

        await page.locator("#btn-add").click()
        await expect(page.locator(".counter-row")).toHaveCount(4)

        await expect(page.locator("#value-4")).toHaveText("Counter 4: 0")
        await expect(page.locator("#counter-4 .counter-display")).toHaveText("Value: 0")

        await expect(page.locator("#value-1")).toHaveText("Counter 1: 1")
        await expect(page.locator("#value-2")).toHaveText("Counter 2: 1")

        await page.locator("#btn-inc-4").click()
        await page.locator("#btn-inc-4").click()
        await page.locator("#btn-inc-4").click()
        await expect(page.locator("#value-4")).toHaveText("Counter 4: 3")
    })

    test("reordering list items preserves individual component states", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#btn-inc-1").click()
        await page.locator("#btn-inc-2").click()
        await page.locator("#btn-inc-2").click()
        await page.locator("#btn-inc-3").click()
        await page.locator("#btn-inc-3").click()
        await page.locator("#btn-inc-3").click()

        await expect(page.locator("#value-1")).toHaveText("Counter 1: 1")
        await expect(page.locator("#value-2")).toHaveText("Counter 2: 2")
        await expect(page.locator("#value-3")).toHaveText("Counter 3: 3")

        await page.locator("#btn-remove-1").click()
        await expect(page.locator(".counter-row")).toHaveCount(2)

        await page.locator("#btn-add").click()

        await expect(page.locator("#value-2")).toHaveText("Counter 2: 2")
        await expect(page.locator("#value-3")).toHaveText("Counter 3: 3")
        await expect(page.locator("#value-4")).toHaveText("Counter 4: 0")
    })
})
