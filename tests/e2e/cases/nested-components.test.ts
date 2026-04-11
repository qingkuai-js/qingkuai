import { test } from "../fixture"
import { expect } from "@playwright/test"

test.describe("nested components case", () => {
    test("renders nested components page", async ({ page, visitScenario }) => {
        await visitScenario("nested-components")

        await expect(page).toHaveTitle("Nested components")
        await expect(page.locator("#nested-title")).toHaveText("Nested Components")
        await expect(page.locator("#nested-panel")).toBeVisible()
        await expect(page.locator("#nested-leaf")).toHaveText("Nested Leaf")
        await expect(page.locator("#nested-panel")).toHaveCount(1)
        await expect(page.locator("#nested-leaf")).toHaveCount(1)
        await expect(page.locator("[data-page='nested-root']")).toContainText("Nested Leaf")
    })
})