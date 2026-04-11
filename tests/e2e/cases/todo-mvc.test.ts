import { test } from "../fixture"
import { expect } from "@playwright/test"

test.describe("todo-mvc case", () => {
    test("renders todo-mvc page", async ({ page, visitScenario }) => {
        await visitScenario("todo-mvc")

        await expect(page).toHaveTitle("TodoMVC")
        await expect(page.locator("h1")).toHaveText("Todo List")
        await expect(page.locator(".new-todo")).toBeVisible()
        await expect(page.locator(".todo-list .todo")).toHaveCount(0)
        await expect(page.locator(".footer")).not.toBeVisible()
        await expect(page.locator(".main")).not.toBeVisible()
    })

    test("can add todos", async ({ page, visitScenario }) => {
        await visitScenario("todo-mvc")

        await page.locator(".new-todo").fill("Buy milk")
        await page.locator(".new-todo").press("Enter")
        await expect(page.locator(".todo-list .todo")).toHaveCount(1)
        await expect(page.locator(".todo-list .todo label").first()).toHaveText("Buy milk")
        await expect(page.locator(".footer")).toBeVisible()
        await expect(page.locator(".todo-count")).toContainText("1")
        await expect(page.locator(".todo-count")).toContainText("item left")

        await page.locator(".new-todo").fill("Walk the dog")
        await page.locator(".new-todo").press("Enter")
        await expect(page.locator(".todo-list .todo")).toHaveCount(2)
        await expect(page.locator(".todo-count")).toContainText("2")
        await expect(page.locator(".todo-count")).toContainText("items left")
    })

    test("input is cleared after adding a todo", async ({ page, visitScenario }) => {
        await visitScenario("todo-mvc")

        await page.locator(".new-todo").fill("Clean up")
        await page.locator(".new-todo").press("Enter")
        await expect(page.locator(".new-todo")).toHaveValue("")
    })

    test("ignores whitespace-only todo input", async ({ page, visitScenario }) => {
        await visitScenario("todo-mvc")

        await page.locator(".new-todo").fill("   ")
        await page.locator(".new-todo").press("Enter")

        await expect(page.locator(".todo-list .todo")).toHaveCount(0)
        await expect(page.locator(".footer")).not.toBeVisible()
        await expect(page.locator(".main")).not.toBeVisible()
    })

    test("trims leading and trailing spaces when adding", async ({ page, visitScenario }) => {
        await visitScenario("todo-mvc")

        await page.locator(".new-todo").fill("   Trim me   ")
        await page.locator(".new-todo").press("Enter")

        await expect(page.locator(".todo-list .todo")).toHaveCount(1)
        await expect(page.locator(".todo-list .todo label")).toHaveText("Trim me")
    })

    test("can complete a todo", async ({ page, visitScenario }) => {
        await visitScenario("todo-mvc")

        await page.locator(".new-todo").fill("Buy milk")
        await page.locator(".new-todo").press("Enter")

        await page.locator(".todo .toggle").click()
        await expect(page.locator(".todo")).toHaveClass(/completed/)
        await expect(page.locator(".todo-count")).toContainText("0")
        await expect(page.locator(".todo-count")).toContainText("items left")
    })

    test("can remove a todo", async ({ page, visitScenario }) => {
        await visitScenario("todo-mvc")

        await page.locator(".new-todo").fill("First")
        await page.locator(".new-todo").press("Enter")
        await page.locator(".new-todo").fill("Second")
        await page.locator(".new-todo").press("Enter")
        await expect(page.locator(".todo-list .todo")).toHaveCount(2)

        await page.locator(".todo .destroy").first().click()
        await expect(page.locator(".todo-list .todo")).toHaveCount(1)
        await expect(page.locator(".todo-list .todo label").first()).toHaveText("Second")
    })

    test("removing last todo hides footer and main", async ({ page, visitScenario }) => {
        await visitScenario("todo-mvc")

        await page.locator(".new-todo").fill("Only one")
        await page.locator(".new-todo").press("Enter")
        await expect(page.locator(".footer")).toBeVisible()

        await page.locator(".todo .destroy").click()
        await expect(page.locator(".todo-list .todo")).toHaveCount(0)
        await expect(page.locator(".footer")).not.toBeVisible()
        await expect(page.locator(".main")).not.toBeVisible()
    })

    test("can edit a todo", async ({ page, visitScenario }) => {
        await visitScenario("todo-mvc")

        await page.locator(".new-todo").fill("Old title")
        await page.locator(".new-todo").press("Enter")

        await page.locator(".todo label").dblclick()
        await expect(page.locator(".todo")).toHaveClass(/editing/)

        await page.locator(".todo .edit").fill("New title")
        await page.locator(".todo .edit").press("Enter")
        await expect(page.locator(".todo")).not.toHaveClass(/editing/)
        await expect(page.locator(".todo label")).toHaveText("New title")
    })

    test("can cancel edit with Escape", async ({ page, visitScenario }) => {
        await visitScenario("todo-mvc")

        await page.locator(".new-todo").fill("Original")
        await page.locator(".new-todo").press("Enter")

        await page.locator(".todo label").dblclick()
        await page.locator(".todo .edit").fill("Changed")
        await page.keyboard.press("Escape")
        await expect(page.locator(".todo")).not.toHaveClass(/editing/)
        await expect(page.locator(".todo label")).toHaveText("Original")
    })

    test("editing with empty title removes the todo", async ({ page, visitScenario }) => {
        await visitScenario("todo-mvc")

        await page.locator(".new-todo").fill("To be deleted via edit")
        await page.locator(".new-todo").press("Enter")
        await expect(page.locator(".todo-list .todo")).toHaveCount(1)

        await page.locator(".todo label").dblclick()
        await page.locator(".todo .edit").fill("")
        await page.keyboard.press("Enter")
        await expect(page.locator(".todo-list .todo")).toHaveCount(0)
    })

    test("editing with whitespace-only title keeps todo and exits editing", async ({ page, visitScenario }) => {
        await visitScenario("todo-mvc")

        await page.locator(".new-todo").fill("To be trimmed-away")
        await page.locator(".new-todo").press("Enter")
        await expect(page.locator(".todo-list .todo")).toHaveCount(1)

        await page.locator(".todo label").dblclick()
        await page.locator(".todo .edit").fill("    ")
        await page.keyboard.press("Enter")
        await expect(page.locator(".todo")).not.toHaveClass(/editing/)
        await expect(page.locator(".todo-list .todo")).toHaveCount(1)
        await expect(page.locator(".todo-count")).toContainText("1")
    })

    test("toggle-all marks all todos as completed", async ({ page, visitScenario }) => {
        await visitScenario("todo-mvc")

        await page.locator(".new-todo").fill("First")
        await page.locator(".new-todo").press("Enter")
        await page.locator(".new-todo").fill("Second")
        await page.locator(".new-todo").press("Enter")

        await page.locator("#toggle-all").check()
        await expect(page.locator(".todo-list .todo").first()).toHaveClass(/completed/)
        await expect(page.locator(".todo-list .todo").nth(1)).toHaveClass(/completed/)
        await expect(page.locator(".todo-count")).toContainText("0")
    })

    test("toggle-all unchecks all when all are completed", async ({ page, visitScenario }) => {
        await visitScenario("todo-mvc")

        await page.locator(".new-todo").fill("First")
        await page.locator(".new-todo").press("Enter")
        await page.locator(".new-todo").fill("Second")
        await page.locator(".new-todo").press("Enter")

        await page.locator("#toggle-all").check()
        await page.locator("#toggle-all").uncheck()
        await expect(page.locator(".todo-list .todo").first()).not.toHaveClass(/completed/)
        await expect(page.locator(".todo-list .todo").nth(1)).not.toHaveClass(/completed/)
        await expect(page.locator(".todo-count")).toContainText("2")
    })

    test("filters show correct todos", async ({ page, visitScenario }) => {
        await visitScenario("todo-mvc")

        await page.locator(".new-todo").fill("Active todo")
        await page.locator(".new-todo").press("Enter")
        await page.locator(".new-todo").fill("Completed todo")
        await page.locator(".new-todo").press("Enter")
        await page.locator(".todo-list .todo").nth(1).locator(".toggle").click()

        await page.locator('.filters a[href="#/active"]').click()
        await expect(page.locator(".todo-list .todo")).toHaveCount(1)
        await expect(page.locator(".todo-list .todo label")).toHaveText("Active todo")

        await page.locator('.filters a[href="#/completed"]').click()
        await expect(page.locator(".todo-list .todo")).toHaveCount(1)
        await expect(page.locator(".todo-list .todo label")).toHaveText("Completed todo")

        await page.locator('.filters a[href="#/all"]').click()
        await expect(page.locator(".todo-list .todo")).toHaveCount(2)
    })

    test("switching completed to all keeps active todos visible", async ({ page, visitScenario }) => {
        await visitScenario("todo-mvc")

        await page.locator(".new-todo").fill("Regression todo")
        await page.locator(".new-todo").press("Enter")
        await expect(page.locator(".todo-list .todo")).toHaveCount(1)

        await page.locator('.filters a[href="#/completed"]').click()
        await expect(page.locator(".todo-list .todo")).toHaveCount(0)

        await page.locator('.filters a[href="#/all"]').click()
        await expect(page.locator(".todo-list .todo")).toHaveCount(1)
        await expect(page.locator(".todo-list .todo label")).toHaveText("Regression todo")
    })

    test("switching active to all keeps active todos visible", async ({ page, visitScenario }) => {
        await visitScenario("todo-mvc")

        await page.locator(".new-todo").fill("Active regression todo")
        await page.locator(".new-todo").press("Enter")
        await expect(page.locator(".todo-list .todo")).toHaveCount(1)

        await page.locator('.filters a[href="#/active"]').click()
        await expect(page.locator(".todo-list .todo")).toHaveCount(1)
        await expect(page.locator(".todo-list .todo label")).toHaveText("Active regression todo")

        await page.locator('.filters a[href="#/all"]').click()
        await expect(page.locator(".todo-list .todo")).toHaveCount(1)
        await expect(page.locator(".todo-list .todo label")).toHaveText("Active regression todo")
    })

    test("adding active todo while viewing completed keeps completed list empty", async ({ page, visitScenario }) => {
        await visitScenario("todo-mvc")

        await page.locator(".new-todo").fill("Existing active")
        await page.locator(".new-todo").press("Enter")
        await expect(page.locator(".todo-list .todo")).toHaveCount(1)

        await page.locator('.filters a[href="#/completed"]').click()
        await expect(page.locator(".todo-list .todo")).toHaveCount(0)

        await page.locator(".new-todo").fill("Should stay hidden in completed")
        await page.locator(".new-todo").press("Enter")

        await expect(page.locator(".todo-list .todo")).toHaveCount(0)
        await expect(page.locator(".todo-count")).toContainText("2")

        await page.locator('.filters a[href="#/all"]').click()
        await expect(page.locator(".todo-list .todo")).toHaveCount(2)
        await expect(page.locator(".todo-list .todo label").first()).toHaveText("Existing active")
        await expect(page.locator(".todo-list .todo label").nth(1)).toHaveText(
            "Should stay hidden in completed"
        )
    })

    test("active filter link is marked as selected", async ({ page, visitScenario }) => {
        await visitScenario("todo-mvc")

        await expect(page.locator('.filters a[href="#/all"]')).toHaveClass(/selected/)
        await expect(page.locator('.filters a[href="#/active"]')).not.toHaveClass(/selected/)
        await expect(page.locator('.filters a[href="#/completed"]')).not.toHaveClass(/selected/)
    })
})
