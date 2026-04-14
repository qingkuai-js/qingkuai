import { expect } from "@playwright/test"

import { test } from "../fixture"

test.describe("html-directive case", () => {
    test("renders html content and updates when source changes", async ({
        page,
        visitScenario
    }) => {
        await visitScenario("html-directive")

        await expect(page).toHaveTitle("Html directive")
        await expect(page.locator("#html-title")).toHaveText("Html directive")
        await expect(page.locator("#html-host #html-strong")).toHaveText("Hello Html")
        await expect(page.locator("#html-host #html-em")).toHaveCount(0)

        await page.locator("#html-set-updated").click()
        await expect(page.locator("#html-host #html-em")).toHaveText("Updated Html")
        await expect(page.locator("#html-host #html-strong")).toHaveCount(0)
    })

    test("supports escapeScript option", async ({ page, visitScenario }) => {
        await visitScenario("html-directive")

        await page.locator("#html-set-script").click()
        await expect(page.locator("#html-host script")).toHaveCount(1)
        await expect(page.locator("#html-host #html-p")).toHaveText("Script tail")

        await page.locator("#html-escape-script").click()
        await expect(page.locator("#html-host script")).toHaveCount(0)
        await expect(page.locator("#html-host")).toContainText("window.__qk_html_test__ = 1")
        await expect(page.locator("#html-host #html-p")).toHaveText("Script tail")
    })

    test("supports custom escapeTags option", async ({ page, visitScenario }) => {
        await visitScenario("html-directive")

        await page.locator("#html-set-iframe").click()
        await expect(page.locator("#html-host iframe#html-frame")).toHaveCount(1)
        await expect(page.locator("#html-host #html-span")).toHaveText("Frame tail")

        await page.locator("#html-escape-iframe").click()
        await expect(page.locator("#html-host iframe#html-frame")).toHaveCount(0)
        await expect(page.locator("#html-host")).toContainText("html-frame")
        await expect(page.locator("#html-host #html-span")).toHaveText("Frame tail")

        await page.locator("#html-escape-none").click()
        await expect(page.locator("#html-host iframe#html-frame")).toHaveCount(1)
    })

    test("compares source-driven updates and options-driven updates", async ({
        page,
        visitScenario
    }) => {
        await visitScenario("html-directive")

        await page.locator("#html-escape-none").click()
        await page.locator("#html-set-initial").click()
        await expect(page.locator("#html-host #html-strong")).toHaveText("Hello Html")

        // rawHtml changes while htmlOptions stays the same
        await page.locator("#html-set-updated").click()
        await expect(page.locator("#html-host #html-em")).toHaveText("Updated Html")
        await expect(page.locator("#html-host #html-strong")).toHaveCount(0)

        await page.locator("#html-escape-none").click()
        await page.locator("#html-set-script").click()
        await expect(page.locator("#html-host script")).toHaveCount(1)
        await expect(page.locator("#html-host #html-p")).toHaveText("Script tail")

        // htmlOptions changes while rawHtml stays the same
        await page.locator("#html-escape-script").click()
        await expect(page.locator("#html-host script")).toHaveCount(0)
        await expect(page.locator("#html-host")).toContainText("window.__qk_html_test__ = 1")
        await expect(page.locator("#html-host #html-p")).toHaveText("Script tail")
    })

    test("supports html directive on qk spread", async ({ page, visitScenario }) => {
        await visitScenario("html-directive")

        await expect(page.locator("#html-spread-host #html-spread-inner")).toHaveText("Spread html")
        await expect(page.locator("#html-spread-host #html-spread-updated")).toHaveCount(0)

        await page.locator("#html-spread-updated").click()
        await expect(page.locator("#html-spread-host #html-spread-updated")).toHaveText(
            "Spread updated"
        )
        await expect(page.locator("#html-spread-host #html-spread-inner")).toHaveCount(0)
    })

    test("supports html directive combined with if", async ({ page, visitScenario }) => {
        await visitScenario("html-directive")

        await expect(page.locator("#html-if-host #html-if-inner")).toHaveText("If html")

        await page.locator("#html-if-updated").click()
        await expect(page.locator("#html-if-host #html-if-inner")).toHaveText("If html updated")

        await page.locator("#html-if-toggle").click()
        await expect(page.locator("#html-if-host #html-if-block")).toHaveCount(0)

        await page.locator("#html-if-toggle").click()
        await expect(page.locator("#html-if-host #html-if-inner")).toHaveText("If html updated")
    })

    test("supports html directive combined with for", async ({ page, visitScenario }) => {
        await visitScenario("html-directive")

        await expect(page.locator("#html-for-host .html-for-inner")).toHaveText(["For A", "For B"])

        await page.locator("#html-for-append").click()
        await expect(page.locator("#html-for-host .html-for-inner")).toHaveText([
            "For A",
            "For B",
            "For C"
        ])

        await page.locator("#html-for-update-second").click()
        await expect(page.locator("#html-for-host .html-for-inner")).toHaveText([
            "For A",
            "For B Updated",
            "For C"
        ])

        await page.locator("#html-for-remove").click()
        await expect(page.locator("#html-for-host .html-for-inner")).toHaveText([
            "For A",
            "For B Updated"
        ])
    })

    test("supports html directive combined with await branches", async ({
        page,
        visitScenario
    }) => {
        await visitScenario("html-directive")

        await expect(page.locator("#html-await-host #html-await-pending-inner")).toHaveText(
            "Pending html"
        )
        await expect(page.locator("#html-await-host #html-await-then-inner")).toHaveCount(0)
        await expect(page.locator("#html-await-host #html-await-catch-inner")).toHaveCount(0)

        await page.locator("#html-await-resolve").click()
        await expect(page.locator("#html-await-host #html-await-then-inner")).toHaveText(
            "Then html"
        )
        await expect(page.locator("#html-await-host #html-await-pending-inner")).toHaveCount(0)

        await page.locator("#html-await-reset").click()
        await expect(page.locator("#html-await-host #html-await-pending-inner")).toHaveText(
            "Pending html"
        )
        await expect(page.locator("#html-await-host #html-await-then-inner")).toHaveCount(0)

        await page.locator("#html-await-reject").click()
        await expect(page.locator("#html-await-host #html-await-catch-inner")).toHaveText(
            "Catch html"
        )
        await expect(page.locator("#html-await-host #html-await-pending-inner")).toHaveCount(0)
    })
})
