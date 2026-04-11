import { test } from "../fixture"
import { expect } from "@playwright/test"

test.describe("collection case", () => {
    test("renders collection page", async ({ page, visitScenario }) => {
        await visitScenario("collection")

        await expect(page).toHaveTitle("Collection operations")
        await expect(page.locator("#collection-title")).toHaveText("Collection")
        await expect(page.locator("#collection-summary")).toHaveText("2 items")
        await expect(page.locator("#collection-list .collection-item")).toHaveCount(2)
        await expect(page.locator("#collection-list .item-trigger").first()).toHaveText("Alpha")
        await expect(page.locator("#collection-list .item-trigger").nth(1)).toHaveText("Beta")
        await expect(page.locator("#collection-list .collection-item").first()).not.toHaveAttribute(
            "data-selected",
            "yes"
        )
        await expect(page.locator("#collection-list .collection-item").nth(1)).not.toHaveAttribute(
            "data-selected",
            "yes"
        )
    })

    test("supports add select and remove flows", async ({ page, visitScenario }) => {
        await visitScenario("collection")

        await page.locator("#add-item").click()
        await expect(page.locator("#collection-summary")).toHaveText("3 items")
        await expect(page.locator("#collection-list .collection-item")).toHaveCount(3)
        await expect(page.locator("#collection-list .item-trigger").last()).toHaveText("Item 3")

        await page.locator("#collection-list .item-trigger").nth(1).click()
        await expect(page.locator("#collection-list .collection-item").nth(1)).toHaveAttribute(
            "data-selected",
            "yes"
        )
        await expect(page.locator("#collection-list .collection-item").first()).not.toHaveAttribute(
            "data-selected",
            "yes"
        )

        await page.locator("#remove-first").click()
        await expect(page.locator("#collection-summary")).toHaveText("2 items")
        await expect(page.locator("#collection-list .collection-item")).toHaveCount(2)
        await expect(page.locator("#collection-list .item-trigger").first()).toHaveText("Beta")
    })

    test("handles empty-list boundary and can recover", async ({ page, visitScenario }) => {
        await visitScenario("collection")

        await page.locator("#remove-first").click()
        await expect(page.locator("#collection-summary")).toHaveText("1 items")

        await page.locator("#remove-first").click()
        await expect(page.locator("#collection-summary")).toHaveText("0 items")
        await expect(page.locator("#collection-list .collection-item")).toHaveCount(0)

        await page.locator("#remove-first").click()
        await expect(page.locator("#collection-summary")).toHaveText("0 items")

        await page.locator("#add-item").click()
        await expect(page.locator("#collection-summary")).toHaveText("1 items")
        await expect(page.locator("#collection-list .item-trigger").first()).toHaveText("Item 3")
    })
})
