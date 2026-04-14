import { expect } from "@playwright/test"

import { test } from "../fixture"

test.describe("await-directive case", () => {
    test("renders await pending state and resolves into then branch", async ({
        page,
        visitScenario
    }) => {
        await visitScenario("await-directive")

        await expect(page).toHaveTitle("Await directive")
        await expect(page.locator("#await-title")).toHaveText("Await directive")
        await expect(page.locator("#branch-await")).toHaveText("Loading branch...")
        await expect(page.locator("#branch-then")).toHaveCount(0)
        await expect(page.locator("#branch-catch")).toHaveCount(0)

        await page.locator("#branch-resolve").click()
        await expect(page.locator("#branch-then")).toHaveText("Resolved user 7: Qingkuai")
        await expect(page.locator("#branch-await")).toHaveCount(0)
        await expect(page.locator("#branch-catch")).toHaveCount(0)
    })

    test("renders catch branch after rejection and can reset back to await", async ({
        page,
        visitScenario
    }) => {
        await visitScenario("await-directive")

        await page.locator("#branch-reject").click()
        await expect(page.locator("#branch-catch")).toHaveText("Rejected 500: branch failed")
        await expect(page.locator("#branch-await")).toHaveCount(0)
        await expect(page.locator("#branch-then")).toHaveCount(0)

        await page.locator("#branch-reset").click()
        await expect(page.locator("#branch-await")).toHaveText("Loading branch...")
        await expect(page.locator("#branch-catch")).toHaveCount(0)
    })

    test("supports pending resolve pending reject cycles on the same promise variable", async ({
        page,
        visitScenario
    }) => {
        await visitScenario("await-directive")

        await expect(page.locator("#branch-await")).toHaveText("Loading branch...")

        await page.locator("#branch-resolve").click()
        await expect(page.locator("#branch-then")).toHaveText("Resolved user 7: Qingkuai")

        await page.locator("#branch-reset").click()
        await expect(page.locator("#branch-await")).toHaveText("Loading branch...")
        await expect(page.locator("#branch-then")).toHaveCount(0)

        await page.locator("#branch-reject").click()
        await expect(page.locator("#branch-catch")).toHaveText("Rejected 500: branch failed")
        await expect(page.locator("#branch-await")).toHaveCount(0)
    })

    test("supports same-tag await and then", async ({ page, visitScenario }) => {
        await visitScenario("await-directive")

        await expect(page.locator("#inline-then")).toHaveCount(0)

        await page.locator("#inline-resolve-trigger").click()
        await expect(page.locator("#inline-then")).toHaveText("Inline resolved: inline done")

        await page.locator("#inline-resolve-reset").click()
        await expect(page.locator("#inline-then")).toHaveCount(0)
    })

    test("supports same-tag await and catch", async ({ page, visitScenario }) => {
        await visitScenario("await-directive")

        await expect(page.locator("#inline-catch")).toHaveCount(0)

        await page.locator("#inline-reject-trigger").click()
        await expect(page.locator("#inline-catch")).toHaveText("Inline rejected: inline failed")

        await page.locator("#inline-reject-reset").click()
        await expect(page.locator("#inline-catch")).toHaveCount(0)
    })

    test("supports qk spread await then catch with multi-child and text-node content", async ({
        page,
        visitScenario
    }) => {
        await visitScenario("await-directive")

        await expect(page.locator("#spread-block")).toContainText("Spread waiting")
        await expect(page.locator("#spread-await-copy")).toHaveText("Spread pending")
        await expect(page.locator("#spread-then-label")).toHaveCount(0)
        await expect(page.locator("#spread-catch-msg")).toHaveCount(0)

        await page.locator("#spread-resolve").click()
        await expect(page.locator("#spread-block")).toContainText("Spread then text")
        await expect(page.locator("#spread-then-label")).toHaveText("Spread resolved")
        await expect(page.locator("#spread-then-extra")).toHaveText("OK")
        await expect(page.locator("#spread-await-copy")).toHaveCount(0)

        await page.locator("#spread-reset").click()
        await expect(page.locator("#spread-block")).toContainText("Spread waiting")
        await expect(page.locator("#spread-await-copy")).toHaveText("Spread pending")
        await expect(page.locator("#spread-then-label")).toHaveCount(0)

        await page.locator("#spread-reject").click()
        await expect(page.locator("#spread-block")).toContainText("Spread catch text")
        await expect(page.locator("#spread-catch-msg")).toHaveText("spread failed")
        await expect(page.locator("#spread-catch-code")).toHaveText("503")
        await expect(page.locator("#spread-await-copy")).toHaveCount(0)
    })

    test("supports then and catch destructuring with multi-child rendering", async ({
        page,
        visitScenario
    }) => {
        await visitScenario("await-directive")

        await expect(page.locator("#structured-await")).toHaveText("Structured waiting")

        await page.locator("#structured-resolve").click()
        await expect(page.locator("#structured-block")).toContainText("Structured resolved")
        await expect(page.locator("#structured-then-id")).toHaveText("12")
        await expect(page.locator("#structured-then-name")).toHaveText("Structured")
        await expect(page.locator("#structured-await")).toHaveCount(0)

        await page.locator("#structured-reset").click()
        await expect(page.locator("#structured-await")).toHaveText("Structured waiting")
        await expect(page.locator("#structured-then-id")).toHaveCount(0)

        await page.locator("#structured-reject").click()
        await expect(page.locator("#structured-block")).toContainText("Structured rejected")
        await expect(page.locator("#structured-catch-msg")).toHaveText("structured failed")
        await expect(page.locator("#structured-catch-code")).toHaveText("418")
    })

    test("await has higher priority than if on the same tag", async ({ page, visitScenario }) => {
        await visitScenario("await-directive")

        await expect(page.locator("#priority-await")).toHaveCount(0)
        await expect(page.locator("#priority-then")).toHaveCount(0)

        await page.locator("#priority-resolve").click()
        await expect(page.locator("#priority-then")).toHaveText("Priority then: priority resolved")
        await expect(page.locator("#priority-await")).toHaveCount(0)

        await page.locator("#priority-reset").click()
        await expect(page.locator("#priority-then")).toHaveCount(0)
        await expect(page.locator("#priority-await")).toHaveCount(0)

        await page.locator("#priority-toggle-if").click()
        await expect(page.locator("#priority-await")).toHaveText("Priority pending")
    })

    test("keeps component await branches between stable siblings", async ({
        page,
        visitScenario
    }) => {
        await visitScenario("await-directive")

        const children = page.locator("#component-await-order-host > *")

        await expect(children).toHaveText(["Before", "Component pending", "After"])
        await expect(page.locator("#component-await-pending")).toHaveText("Component pending")
        await expect(page.locator("#component-await-then")).toHaveCount(0)
        await expect(page.locator("#component-await-catch")).toHaveCount(0)

        await page.locator("#component-await-resolve").click()
        await expect(children).toHaveText(["Before", "Component then: component resolved", "After"])
        await expect(page.locator("#component-await-pending")).toHaveCount(0)
        await expect(page.locator("#component-await-catch")).toHaveCount(0)

        await page.locator("#component-await-reset").click()
        await expect(children).toHaveText(["Before", "Component pending", "After"])
        await expect(page.locator("#component-await-then")).toHaveCount(0)

        await page.locator("#component-await-reject").click()
        await expect(children).toHaveText(["Before", "Component catch: component failed", "After"])
        await expect(page.locator("#component-await-pending")).toHaveCount(0)
        await expect(page.locator("#component-await-then")).toHaveCount(0)
    })
})
