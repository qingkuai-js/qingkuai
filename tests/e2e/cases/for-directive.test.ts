import { expect } from "@playwright/test"

import { test } from "../fixture"

test.describe("for-directive case", () => {
    test("renders basic list, destructuring list, and numeric repeat list", async ({
        page,
        visitScenario
    }) => {
        await visitScenario("for-directive")

        await expect(page).toHaveTitle("For directive")
        await expect(page.locator("#for-title")).toHaveText("For directive")

        await expect(page.locator("#for-basic-list .for-basic-item")).toHaveCount(2)
        await expect(page.locator("#for-basic-list .for-basic-item").first()).toHaveText("0:Alpha")
        await expect(page.locator("#for-basic-list .for-basic-item").nth(1)).toHaveText("1:Beta")

        await expect(page.locator("#for-destructure-list .for-destructure-item")).toHaveText([
            "1-Alpha",
            "2-Beta"
        ])
        await expect(page.locator("#for-repeat-host .for-repeat-item")).toHaveCount(3)
    })

    test("supports add remove and swap flows for list source updates", async ({
        page,
        visitScenario
    }) => {
        await visitScenario("for-directive")

        await page.locator("#for-add-item").click()
        await expect(page.locator("#for-basic-list .for-basic-item")).toHaveCount(3)
        await expect(page.locator("#for-basic-list .for-basic-item").nth(2)).toHaveText("2:Item 3")
        await expect(page.locator("#for-destructure-list .for-destructure-item").nth(2)).toHaveText(
            "3-Item 3"
        )

        await page.locator("#for-swap-items").click()
        await expect(page.locator("#for-basic-list .for-basic-item")).toHaveText([
            "0:Beta",
            "1:Alpha",
            "2:Item 3"
        ])

        await page.locator("#for-remove-item").click()
        await expect(page.locator("#for-basic-list .for-basic-item")).toHaveCount(2)
        await expect(page.locator("#for-basic-list .for-basic-item")).toHaveText([
            "0:Beta",
            "1:Alpha"
        ])
    })

    test("supports for on component tags", async ({ page, visitScenario }) => {
        await visitScenario("for-directive")

        await expect(page.locator("#for-component-list .for-component-item")).toHaveCount(2)
        await expect(page.locator("#for-component-list")).toContainText("0:Alpha")
        await expect(page.locator("#for-component-list")).toContainText("1:Beta")

        await page.locator("#for-add-item").click()
        await expect(page.locator("#for-component-list .for-component-item")).toHaveCount(3)
        await expect(page.locator("#for-component-list")).toContainText("2:Item 3")

        await page.locator("#for-remove-item").click()
        await expect(page.locator("#for-component-list .for-component-item")).toHaveCount(2)
        await expect(page.locator("#for-component-list")).toContainText("Alpha")
        await expect(page.locator("#for-component-list")).toContainText("Beta")
        await expect(page.locator("#for-component-list")).not.toContainText("Item 3")
    })

    test("keeps component for blocks between stable siblings during updates", async ({
        page,
        visitScenario
    }) => {
        await visitScenario("for-directive")

        const markers = page.locator("#for-component-order-host .for-component-order-marker")
        const rows = page.locator("#for-component-order-host .for-component-order-text")

        await expect(markers).toHaveText(["Before", "After"])
        await expect(rows).toHaveCount(2)
        await expect(page.locator("#for-component-order-host")).toContainText("0:Alpha")
        await expect(page.locator("#for-component-order-host")).toContainText("1:Beta")

        await page.locator("#for-add-item").click()
        await expect(markers).toHaveText(["Before", "After"])
        await expect(rows).toHaveCount(3)
        await expect(page.locator("#for-component-order-host")).toContainText("2:Item 3")

        await page.locator("#for-swap-items").click()
        await expect(markers).toHaveText(["Before", "After"])
        await expect(rows).toHaveCount(3)

        await page.locator("#for-remove-item").click()
        await expect(markers).toHaveText(["Before", "After"])
        await expect(rows).toHaveCount(2)
        await expect(page.locator("#for-component-order-host")).not.toContainText("2:Item 3")
    })

    test("supports numeric source boundary updates", async ({ page, visitScenario }) => {
        await visitScenario("for-directive")

        await expect(page.locator("#for-repeat-host .for-repeat-item")).toHaveCount(3)

        await page.locator("#for-repeat-zero").click()
        await expect(page.locator("#for-repeat-host .for-repeat-item")).toHaveCount(0)

        await page.locator("#for-repeat-four").click()
        await expect(page.locator("#for-repeat-host .for-repeat-item")).toHaveCount(4)
    })

    test("supports nested if branches inside for items", async ({ page, visitScenario }) => {
        await visitScenario("for-directive")

        await expect(page.locator("#for-if-nested-list .for-if-hit")).toHaveText([
            "show:Alpha",
            "show:Beta"
        ])
        await expect(page.locator("#for-if-nested-list .for-if-miss")).toHaveCount(0)

        await page.locator("#for-toggle-even-only").click()
        await expect(page.locator("#for-if-nested-list .for-if-hit")).toHaveText(["show:Beta"])
        await expect(page.locator("#for-if-nested-list .for-if-miss")).toHaveText(["hide:Alpha"])

        await page.locator("#for-add-item").click()
        await expect(page.locator("#for-if-nested-list .for-if-hit")).toHaveText(["show:Beta"])
        await expect(page.locator("#for-if-nested-list .for-if-miss")).toHaveText([
            "hide:Alpha",
            "hide:Item 3"
        ])

        await page.locator("#for-toggle-even-only").click()
        await expect(page.locator("#for-if-nested-list .for-if-hit")).toHaveText([
            "show:Alpha",
            "show:Beta",
            "show:Item 3"
        ])
        await expect(page.locator("#for-if-nested-list .for-if-miss")).toHaveCount(0)
    })

    test("supports for on qk spread with multi-child rendering", async ({
        page,
        visitScenario
    }) => {
        await visitScenario("for-directive")

        await expect(page.locator("#for-spread-host .for-spread-label")).toHaveText([
            "Spread A",
            "Spread B"
        ])
        await expect(page.locator("#for-spread-host .for-spread-action")).toHaveText([
            "Action A",
            "Action B"
        ])

        await page.locator("#for-toggle-spread").click()
        await expect(page.locator("#for-spread-host .for-spread-label")).toHaveText(["Spread C"])
        await expect(page.locator("#for-spread-host .for-spread-action")).toHaveText(["Action C"])

        await page.locator("#for-toggle-spread").click()
        await expect(page.locator("#for-spread-host .for-spread-label")).toHaveText([
            "Spread A",
            "Spread B"
        ])
    })

    test("supports nested for blocks and inner-list updates", async ({ page, visitScenario }) => {
        await visitScenario("for-directive")

        await expect(page.locator("#for-nested-groups .for-group-item")).toHaveCount(2)
        await expect(page.locator("#for-nested-groups .for-group-title")).toHaveText([
            "Group A",
            "Group B"
        ])
        await expect(
            page.locator("#for-nested-groups .for-group-item").first().locator(".for-group-entry")
        ).toHaveText(["A1", "A2"])

        await page.locator("#for-append-group-entry").click()
        await expect(
            page.locator("#for-nested-groups .for-group-item").first().locator(".for-group-entry")
        ).toHaveText(["A1", "A2", "A3"])
    })
})
