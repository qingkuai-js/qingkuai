import { test } from "../fixture"
import { expect } from "@playwright/test"

test.describe("counter case", () => {
    test("renders counter page", async ({ page, visitScenario }) => {
        await visitScenario("counter")

        await expect(page).toHaveTitle("Counter interactions")
        await expect(page.locator("#counter-title")).toHaveText("Counter")
        await expect(page.locator("#counter-value")).toHaveText("0")
        await expect(page.locator("#decrement")).toHaveText("Decrease")
        await expect(page.locator("#increment")).toHaveText("Increase")
    })

    test("updates counter value after each click", async ({ page, visitScenario }) => {
        await visitScenario("counter")

        await expect(page.locator("#counter-value")).toHaveText("0")

        await page.locator("#increment").click()
        await expect(page.locator("#counter-value")).toHaveText("1")

        await page.locator("#increment").click()
        await expect(page.locator("#counter-value")).toHaveText("2")

        await page.locator("#decrement").click()
        await expect(page.locator("#counter-value")).toHaveText("1")
    })

    test("supports decrement-first and negative values", async ({ page, visitScenario }) => {
        await visitScenario("counter")

        await page.locator("#decrement").click()
        await expect(page.locator("#counter-value")).toHaveText("-1")

        await page.locator("#increment").click()
        await expect(page.locator("#counter-value")).toHaveText("0")
    })
})