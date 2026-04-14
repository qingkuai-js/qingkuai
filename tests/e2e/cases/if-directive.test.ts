import { expect } from "@playwright/test"

import { test } from "../fixture"

test.describe("if-directive case", () => {
    test("if has higher priority than for on the same tag", async ({ page, visitScenario }) => {
        await visitScenario("if-directive")

        await expect(page).toHaveTitle("If directive")
        await expect(page.locator("#if-title")).toHaveText("If directive")
        await expect(page.locator("#if-for-list .if-for-item")).toHaveCount(0)

        await page.locator("#toggle-list").click()
        await expect(page.locator("#if-for-list .if-for-item")).toHaveCount(2)
        await expect(page.locator("#if-for-list .if-for-item").first()).toHaveText("Alpha")
        await expect(page.locator("#if-for-list .if-for-item").nth(1)).toHaveText("Beta")

        await page.locator("#toggle-list").click()
        await expect(page.locator("#if-for-list .if-for-item")).toHaveCount(0)

        await page.locator("#toggle-list").click()
        await expect(page.locator("#if-for-list .if-for-item")).toHaveCount(2)

        await page.locator("#toggle-list").click()
        await expect(page.locator("#if-for-list .if-for-item")).toHaveCount(0)

        await page.locator("#toggle-list").click()
        await expect(page.locator("#if-for-list .if-for-item")).toHaveCount(2)
        await expect(page.locator("#if-for-list .if-for-item")).toHaveText(["Alpha", "Beta"])
    })

    test("supports if on qk spread", async ({ page, visitScenario }) => {
        await visitScenario("if-directive")

        await expect(page.locator("#spread-host")).toHaveText("")
        await expect(page.locator("#spread-copy")).toHaveCount(0)
        await expect(page.locator("#spread-action")).toHaveCount(0)

        await page.locator("#toggle-spread").click()
        await expect(page.locator("#spread-host")).toContainText("Spread text")
        await expect(page.locator("#spread-copy")).toHaveText("Spread copy")
        await expect(page.locator("#spread-action")).toHaveText("Spread action")

        await page.locator("#toggle-spread").click()
        await expect(page.locator("#spread-host")).toHaveText("")
        await expect(page.locator("#spread-copy")).toHaveCount(0)
        await expect(page.locator("#spread-action")).toHaveCount(0)
    })

    test("supports if on component tags", async ({ page, visitScenario }) => {
        await visitScenario("if-directive")

        await expect(page.locator("#component-fallback")).toHaveText("Component fallback")
        await expect(page.locator("#component-content")).toHaveCount(0)

        await page.locator("#toggle-component").click()
        await expect(page.locator("#component-fallback")).toHaveCount(0)
        await expect(page.locator("#component-content")).toHaveText("Component content")

        await page.locator("#toggle-component").click()
        await expect(page.locator("#component-fallback")).toHaveText("Component fallback")
        await expect(page.locator("#component-content")).toHaveCount(0)
    })

    test("keeps component if branch between stable siblings", async ({ page, visitScenario }) => {
        await visitScenario("if-directive")

        const children = page.locator("#component-order-host > *")

        await expect(children).toHaveText(["Before", "After"])
        await expect(page.locator("#component-order-content")).toHaveCount(0)

        await page.locator("#toggle-component").click()
        await expect(children).toHaveText(["Before", "Component content", "After"])
        await expect(page.locator("#component-order-content")).toHaveText("Component content")

        await page.locator("#toggle-component").click()
        await expect(children).toHaveText(["Before", "After"])
        await expect(page.locator("#component-order-content")).toHaveCount(0)

        await page.locator("#toggle-component").click()
        await expect(children).toHaveText(["Before", "Component content", "After"])
        await expect(page.locator("#component-order-content")).toHaveText("Component content")
    })

    test("supports if elif else branch switching", async ({ page, visitScenario }) => {
        await visitScenario("if-directive")

        await expect(page.locator("#lang-other")).toHaveText("Other language")
        await expect(page.locator("#lang-qk")).toHaveCount(0)
        await expect(page.locator("#lang-js")).toHaveCount(0)
        await expect(page.locator("#lang-ts")).toHaveCount(0)

        await page.locator("#cycle-language").click()
        await expect(page.locator("#lang-qk")).toHaveText("Qingkuai")
        await expect(page.locator("#lang-other")).toHaveCount(0)

        await page.locator("#cycle-language").click()
        await expect(page.locator("#lang-js")).toHaveText("JavaScript")
        await expect(page.locator("#lang-qk")).toHaveCount(0)

        await page.locator("#cycle-language").click()
        await expect(page.locator("#lang-ts")).toHaveText("TypeScript")
        await expect(page.locator("#lang-js")).toHaveCount(0)

        await page.locator("#cycle-language").click()
        await expect(page.locator("#lang-other")).toHaveText("Other language")
        await expect(page.locator("#lang-ts")).toHaveCount(0)
    })

    test("supports qk spread if elif else branch switching", async ({ page, visitScenario }) => {
        await visitScenario("if-directive")

        await expect(page.locator("#spread-branch-host")).toContainText("Else branch")
        await expect(page.locator("#spread-branch-host")).toContainText("Spread else text")
        await expect(page.locator("#spread-branch-if")).toHaveCount(0)
        await expect(page.locator("#spread-branch-elif")).toHaveCount(0)

        await page.locator("#cycle-spread-branch").click()
        await expect(page.locator("#spread-branch-host")).toContainText("If branch")
        await expect(page.locator("#spread-branch-host")).toContainText("Spread if text")
        await expect(page.locator("#spread-branch-else")).toHaveCount(0)
        await expect(page.locator("#spread-branch-elif")).toHaveCount(0)

        await page.locator("#cycle-spread-branch").click()
        await expect(page.locator("#spread-branch-host")).toContainText("Elif branch")
        await expect(page.locator("#spread-branch-host")).toContainText("Spread elif text")
        await expect(page.locator("#spread-branch-if")).toHaveCount(0)
        await expect(page.locator("#spread-branch-else")).toHaveCount(0)

        await page.locator("#cycle-spread-branch").click()
        await expect(page.locator("#spread-branch-host")).toContainText("Else branch")
        await expect(page.locator("#spread-branch-host")).toContainText("Spread else text")
        await expect(page.locator("#spread-branch-if")).toHaveCount(0)
        await expect(page.locator("#spread-branch-elif")).toHaveCount(0)
    })

    test("supports full component if elif else chain switching", async ({
        page,
        visitScenario
    }) => {
        await visitScenario("if-directive")

        const markers = page.locator("#component-chain-host .component-chain-marker")

        await expect(markers).toHaveText(["Before chain", "After chain"])
        await expect(page.locator("#component-chain-else")).toHaveText("Component else branch")
        await expect(page.locator("#component-chain-if")).toHaveCount(0)
        await expect(page.locator("#component-chain-elif")).toHaveCount(0)

        await page.locator("#cycle-component-branch").click()
        await expect(markers).toHaveText(["Before chain", "After chain"])
        await expect(page.locator("#component-chain-if")).toHaveText("Component if branch")
        await expect(page.locator("#component-chain-else")).toHaveCount(0)
        await expect(page.locator("#component-chain-elif")).toHaveCount(0)

        await page.locator("#cycle-component-branch").click()
        await expect(markers).toHaveText(["Before chain", "After chain"])
        await expect(page.locator("#component-chain-elif")).toHaveText("Component elif branch")
        await expect(page.locator("#component-chain-if")).toHaveCount(0)
        await expect(page.locator("#component-chain-else")).toHaveCount(0)

        await page.locator("#cycle-component-branch").click()
        await expect(markers).toHaveText(["Before chain", "After chain"])
        await expect(page.locator("#component-chain-else")).toHaveText("Component else branch")
        await expect(page.locator("#component-chain-if")).toHaveCount(0)
        await expect(page.locator("#component-chain-elif")).toHaveCount(0)
    })
})
