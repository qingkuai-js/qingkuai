import type { E2EScenarioInput } from "#type-declarations/testing"

import { formatSourceCode } from "../../../src/util/shared/sundry"
import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import RowPanel from "./components/RowPanel"

            let nextId = 2
            let items = [
                { id: 1, label: "Alpha" },
                { id: 2, label: "Beta" }
            ]

            const addItem = () => {
                nextId++
                items.push({ id: nextId, label: "Item " + nextId })
            }

            const removeLastItem = () => {
                if (items.length) {
                    items.pop()
                }
            }
        </lang-js>

        <section data-page="for-directive-components">
            <h1 id="for-title">For directive</h1>

            <div>
                <button
                    id="for-add-item"
                    @click={addItem()}
                >
                    Add item
                </button>
                <button
                    id="for-remove-item"
                    @click={removeLastItem()}
                >
                    Remove last
                </button>
            </div>

            <div id="for-component-list">
                <RowPanel
                    #for={item, index of items}
                    #key={item.id}
                >
                    <span class="for-component-text">{index}:{item.label}</span>
                </RowPanel>
            </div>

            <div id="for-component-order-host">
                <span class="for-component-order-marker">Before</span>
                <RowPanel
                    #for={item, index of items}
                    #key={"order-" + item.id}
                >
                    <span class="for-component-order-text">{index}:{item.label}</span>
                </RowPanel>
                <span class="for-component-order-marker">After</span>
            </div>
        </section>
    `,
    components: {
        RowPanel: formatSourceCode(`
            <article class="for-component-item">
                <slot></slot>
            </article>
        `)
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports for on component tags", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#for-component-list .for-component-item")).toHaveCount(2)

        await page.locator("#for-add-item").click()
        await expect(page.locator("#for-component-list .for-component-item")).toHaveCount(3)

        await page.locator("#for-remove-item").click()
        await expect(page.locator("#for-component-list .for-component-item")).toHaveCount(2)
    })

    test("keeps component for blocks between stable siblings during updates", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const markers = page.locator("#for-component-order-host .for-component-order-marker")
        await expect(markers).toHaveText(["Before", "After"])

        await page.locator("#for-add-item").click()
        await expect(markers).toHaveText(["Before", "After"])

        await page.locator("#for-remove-item").click()
        await expect(markers).toHaveText(["Before", "After"])
    })
})
