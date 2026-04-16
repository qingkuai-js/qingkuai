import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let nextId = 2
            let selectedId = 0
            const items = [
                { id: 1, label: "Alpha" },
                { id: 2, label: "Beta" }
            ]

            const addItem = () => {
                nextId++
                items.push({
                    id: nextId,
                    label: "Item " + nextId
                })
            }

            const removeFirst = () => {
                if (items.length) {
                    items.splice(0, 1)
                }
            }

            const selectItem = item => {
                selectedId = item.id
            }
        </lang-js>

        <section data-page="collection">
            <h1 id="collection-title">Collection</h1>
            <div>
                <button
                    id="add-item"
                    @click={addItem}
                >
                    Add item
                </button>
                <button
                    id="remove-first"
                    @click={removeFirst}
                >
                    Remove first
                </button>
            </div>
            <p id="collection-summary">{items.length} items</p>
            <ul id="collection-list">
                <li
                    #for={item of items}
                    #key={item.id}
                    class="collection-item"
                    !data-id={item.id}
                    !data-selected={selectedId === item.id ? "yes" : "no"}
                >
                    <button
                        class="item-trigger"
                        @click={selectItem(item)}
                    >
                        {item.label}
                    </button>
                </li>
            </ul>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test.describe("collection case", () => {
        test("renders collection page", async ({ page, visitScenario }) => {
            await visitScenario(scenario)

            await expect(page).toHaveTitle("collection")
            await expect(page.locator("#collection-title")).toHaveText("Collection")
            await expect(page.locator("#collection-summary")).toHaveText("2 items")
            await expect(page.locator("#collection-list .collection-item")).toHaveCount(2)
            await expect(page.locator("#collection-list .item-trigger").first()).toHaveText("Alpha")
            await expect(page.locator("#collection-list .item-trigger").nth(1)).toHaveText("Beta")
            await expect(
                page.locator("#collection-list .collection-item").first()
            ).not.toHaveAttribute("data-selected", "yes")
            await expect(
                page.locator("#collection-list .collection-item").nth(1)
            ).not.toHaveAttribute("data-selected", "yes")
        })

        test("supports add select and remove flows", async ({ page, visitScenario }) => {
            await visitScenario(scenario)

            await page.locator("#add-item").click()
            await expect(page.locator("#collection-summary")).toHaveText("3 items")
            await expect(page.locator("#collection-list .collection-item")).toHaveCount(3)
            await expect(page.locator("#collection-list .item-trigger").last()).toHaveText("Item 3")

            await page.locator("#collection-list .item-trigger").nth(1).click()
            await expect(page.locator("#collection-list .collection-item").nth(1)).toHaveAttribute(
                "data-selected",
                "yes"
            )
            await expect(
                page.locator("#collection-list .collection-item").first()
            ).not.toHaveAttribute("data-selected", "yes")

            await page.locator("#remove-first").click()
            await expect(page.locator("#collection-summary")).toHaveText("2 items")
            await expect(page.locator("#collection-list .collection-item")).toHaveCount(2)
            await expect(page.locator("#collection-list .item-trigger").first()).toHaveText("Beta")
        })

        test("handles empty-list boundary and can recover", async ({ page, visitScenario }) => {
            await visitScenario(scenario)

            await page.locator("#remove-first").click()
            await expect(page.locator("#collection-summary")).toHaveText("1 items")

            await page.locator("#remove-first").click()
            await expect(page.locator("#collection-summary")).toHaveText("0 items")
            await expect(page.locator("#collection-list .collection-item")).toHaveCount(0)

            await page.locator("#remove-first").click()
            await expect(page.locator("#collection-summary")).toHaveText("0 items")

            await page.locator("#add-item").click()
            await expect(page.locator("#collection-summary")).toHaveText("1 items")
            await expect(page.locator("#collection-list .item-trigger").first()).toHaveText(
                "Item 3"
            )
        })
    })
})
