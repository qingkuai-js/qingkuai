import { expect } from "@playwright/test"

import { test } from "../fixture"

test.describe("target-directive case", () => {
    test("renders content inline when target is null", async ({ page, visitScenario }) => {
        await visitScenario("target-directive")

        await expect(page).toHaveTitle("Target directive")
        await expect(page.locator("#target-title")).toHaveText("Target directive")
        await expect(page.locator("#target-source-container #target-content")).toBeVisible()
        await expect(page.locator("#target-content")).toHaveText("Initial content")
        await expect(page.locator("#target-dest-a #target-content")).toHaveCount(0)
        await expect(page.locator("#target-dest-b #target-content")).toHaveCount(0)
    })

    test("supports target directive on qk spread", async ({ page, visitScenario }) => {
        await visitScenario("target-directive")

        await expect(page.locator("#target-spread-source .target-spread-item")).toHaveText([
            "Spread One",
            "Spread Two"
        ])

        await page.locator("#target-spread-to-a").click()
        await expect(page.locator("#target-dest-a .target-spread-item")).toHaveText([
            "Spread One",
            "Spread Two"
        ])
        await expect(page.locator("#target-spread-source .target-spread-item")).toHaveCount(0)

        await page.locator("#target-spread-reset").click()
        await expect(page.locator("#target-spread-source .target-spread-item")).toHaveText([
            "Spread One",
            "Spread Two"
        ])
    })

    test("supports target directive with component content", async ({ page, visitScenario }) => {
        await visitScenario("target-directive")

        await expect(page.locator("#target-component-source #target-component-content")).toHaveText(
            "Component payload"
        )

        await page.locator("#target-component-to-b").click()
        await expect(page.locator("#target-dest-b #target-component-content")).toHaveText(
            "Component payload"
        )
        await expect(
            page.locator("#target-component-source #target-component-content")
        ).toHaveCount(0)

        await page.locator("#target-component-reset").click()
        await expect(page.locator("#target-component-source #target-component-content")).toHaveText(
            "Component payload"
        )
    })

    test("supports target directive on component tag syntax", async ({ page, visitScenario }) => {
        await visitScenario("target-directive")

        await expect(
            page.locator("#target-component-tag-source #target-component-tag-content")
        ).toHaveText("Component tag payload")

        await page.locator("#target-component-tag-to-a").click()
        await expect(page.locator("#target-component-tag-content")).toHaveCount(1)

        await page.locator("#target-component-tag-reset").click()
        await expect(
            page.locator("#target-component-tag-source #target-component-tag-content")
        ).toHaveCount(1)
    })

    test("supports target directive combined with if for and await", async ({
        page,
        visitScenario
    }) => {
        await visitScenario("target-directive")

        await page.locator("#target-if-to-a").click()
        await expect(page.locator("#target-dest-a #target-if-content")).toHaveText("If payload")

        await page.locator("#target-if-toggle").click()
        await expect(page.locator("#target-dest-a #target-if-content")).toHaveCount(0)
        await page.locator("#target-if-toggle").click()
        await expect(page.locator("#target-dest-a #target-if-content")).toHaveText("If payload")

        await page.locator("#target-for-to-b").click()
        await expect(page.locator("#target-dest-b .target-for-item")).toHaveCount(2)
        await expect(page.locator("#target-dest-b")).toContainText("For A")
        await expect(page.locator("#target-dest-b")).toContainText("For B")
        await page.locator("#target-for-append").click()
        await expect(page.locator("#target-dest-b .target-for-item")).toHaveCount(3)
        await expect(page.locator("#target-dest-b")).toContainText("For C")

        await page.locator("#target-await-to-a").click()
        await expect(page.locator("#target-dest-a #target-await-pending")).toHaveText(
            "Await pending"
        )
        await page.locator("#target-await-resolve").click()
        await expect(page.locator("#target-dest-a #target-await-then")).toHaveText("Await resolved")
        await expect(page.locator("#target-dest-a #target-await-pending")).toHaveCount(0)
    })

    test("works with destination nodes that also bind &dom", async ({ page, visitScenario }) => {
        await visitScenario("target-directive")

        await expect(page.locator("#target-source-container #target-content")).toHaveText(
            "Initial content"
        )

        await page.locator("#target-to-a").click()
        await expect(page.locator("#target-dest-a #target-content")).toHaveText("Initial content")
        await expect(page.locator("#target-source-container #target-content")).toHaveCount(0)

        await page.locator("#target-to-b").click()
        await expect(page.locator("#target-dest-b #target-content")).toHaveText("Initial content")
        await expect(page.locator("#target-dest-a #target-content")).toHaveCount(0)

        await page.locator("#target-reset").click()
        await expect(page.locator("#target-source-container #target-content")).toHaveText(
            "Initial content"
        )
    })

    test("teleports to a delayed node rendered by await", async ({ page, visitScenario }) => {
        await visitScenario("target-directive")

        await expect(page.locator("#target-delayed-await-pending")).toHaveText(
            "Waiting delayed destination"
        )
        await expect(page.locator("#target-delayed-dest")).toHaveCount(0)

        await page.locator("#target-delayed-resolve").click()
        await expect(page.locator("#target-delayed-dest")).toHaveText("Delayed destination ready")

        await page.locator("#target-delayed-teleport").click()
        await expect(page.locator("#target-delayed-dest #target-delayed-content")).toHaveText(
            "Delayed payload"
        )
        await expect(page.locator("#target-delayed-source #target-delayed-content")).toHaveCount(0)

        await page.locator("#target-delayed-reset").click()
        await expect(page.locator("#target-delayed-source #target-delayed-content")).toHaveText(
            "Delayed payload"
        )
        await expect(page.locator("#target-delayed-dest #target-delayed-content")).toHaveCount(0)
    })
})
