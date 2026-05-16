import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    compileOptions: { whitespace: "collapse" },
    input: `
        <lang-js>
            import { nextTick } from "qingkuai"

            let editingIndex = -1
            let filterKind = "all"
            let titleBeforeEdited = ""

            const todos = []
            const editInputs = []

            const filter = derived(() => {
                const active = []
                const completed = []
                for (const todo of todos) {
                    if (todo.completed) {
                        completed.push(todo)
                    } else {
                        active.push(todo)
                    }
                }
                return { active, completed }
            })
            const activeCount = derivedExp(filter.active.length)
            const filtered = derivedExp(filterKind === "all" ? todos : filter[filterKind])

            function handleAddTodo(e) {
                const input = e.target
                const value = input.value.trim()
                if (value) {
                    todos.push({
                        title: value,
                        id: Date.now(),
                        completed: false
                    })
                    input.value = ""
                }
            }

            function handleRemoveTodo(index) {
                todos.splice(index, 1)
            }

            function handleEditTodo(index) {
                editingIndex = index
                titleBeforeEdited = todos[index].title
                nextTick(() => editInputs[index].focus())
            }

            function handleToggleAllTodos(e) {
                const input = e.target
                todos.forEach(t => (t.completed = input.checked))
            }

            function handleConfirmEdit() {
                if (editingIndex !== -1 && !todos[editingIndex].title) {
                    handleRemoveTodo(editingIndex)
                }
                editingIndex = -1
            }

            function handleCancelEdit() {
                if (editingIndex === -1) {
                    return
                }
                todos[editingIndex].title = titleBeforeEdited
                editingIndex = -1
            }

            window.addEventListener("hashchange", () => {
                const kind = window.location.hash.replace(/#\\/?/, "")
                if (/^(?:all|active|completed)$/.test(kind)) {
                    filterKind = kind
                } else {
                    filterKind = "all"
                    window.location.hash = ""
                }
            })
        </lang-js>

        <div
            class="app-shell"
            data-page="todo-mvc"
        >
            <header class="header">
                <h1>Todo List</h1>
                <input
                    autofocus
                    class="new-todo"
                    placeholder="What needs to be done?"
                    @keyup|enter={handleAddTodo}
                />
            </header>
            <main
                class="main"
                !hidden={!filtered.length}
            >
                <div !hidden={filterKind === "completed"}>
                    <input
                        id="toggle-all"
                        type="checkbox"
                        class="toggle-all"
                        @change={handleToggleAllTodos}
                        !checked={!filter.active.length}
                        !disabled={!todos.length}
                    />
                    <label for="toggle-all">Mark all as completed</label>
                </div>
                <ul class="todo-list">
                    <li
                        class="todo"
                        #for={todo, index of filtered}
                        #key={todo.id}
                        !class={
                            {
                                completed: todo.completed,
                                editing: index === editingIndex
                            }
                        }
                    >
                        <div class="view">
                            <input
                                class="toggle"
                                type="checkbox"
                                &checked={todo.completed}
                            />
                            <label @dblclick={handleEditTodo(index)}>{todo.title}</label>
                            <button
                                class="destroy"
                                @click={handleRemoveTodo(index)}
                            >
                                x
                            </button>
                        </div>
                        <input
                            type="text"
                            class="edit"
                            #if={index === editingIndex}
                            &value={todo.title}
                            &handle={editInputs[index]}
                            @blur={handleConfirmEdit}
                            @keydown|esc={handleCancelEdit}
                            @keyup|enter={handleConfirmEdit}
                        />
                    </li>
                </ul>
            </main>
            <footer
                class="footer"
                !hidden={!todos.length}
            >
                <span class="todo-count">
                    <strong>{activeCount}</strong>
                    <span>item{activeCount === 1 ? "" : "s"} left</span>
                </span>
                <ul class="filters">
                    <li>
                        <a
                            href="#/all"
                            !class={{ selected: filterKind === "all" }}
                        >
                            All
                        </a>
                    </li>
                    <li>
                        <a
                            href="#/active"
                            !class={{ selected: filterKind === "active" }}
                        >
                            Active
                        </a>
                    </li>
                    <li>
                        <a
                            href="#/completed"
                            !class={{ selected: filterKind === "completed" }}
                        >
                            Completed
                        </a>
                    </li>
                </ul>
            </footer>
        </div>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test.describe("todo-mvc case", () => {
        test("renders todo-mvc page", async ({ page, visitScenario }) => {
            await visitScenario(scenario)

            await expect(page).toHaveTitle("todo-mvc")
            await expect(page.locator("h1")).toHaveText("Todo List")
            await expect(page.locator(".new-todo")).toBeVisible()
            await expect(page.locator(".todo-list .todo")).toHaveCount(0)
            await expect(page.locator(".footer")).not.toBeVisible()
            await expect(page.locator(".main")).not.toBeVisible()
        })

        test("can add todos", async ({ page, visitScenario }) => {
            await visitScenario(scenario)

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
            await visitScenario(scenario)

            await page.locator(".new-todo").fill("Clean up")
            await page.locator(".new-todo").press("Enter")
            await expect(page.locator(".new-todo")).toHaveValue("")
        })

        test("ignores whitespace-only todo input", async ({ page, visitScenario }) => {
            await visitScenario(scenario)

            await page.locator(".new-todo").fill("   ")
            await page.locator(".new-todo").press("Enter")

            await expect(page.locator(".todo-list .todo")).toHaveCount(0)
            await expect(page.locator(".footer")).not.toBeVisible()
            await expect(page.locator(".main")).not.toBeVisible()
        })

        test("trims leading and trailing spaces when adding", async ({ page, visitScenario }) => {
            await visitScenario(scenario)

            await page.locator(".new-todo").fill("   Trim me   ")
            await page.locator(".new-todo").press("Enter")

            await expect(page.locator(".todo-list .todo")).toHaveCount(1)
            await expect(page.locator(".todo-list .todo label")).toHaveText("Trim me")
        })

        test("can complete a todo", async ({ page, visitScenario }) => {
            await visitScenario(scenario)

            await page.locator(".new-todo").fill("Buy milk")
            await page.locator(".new-todo").press("Enter")

            await page.locator(".todo .toggle").click()
            await expect(page.locator(".todo")).toHaveClass(/completed/)
            await expect(page.locator(".todo-count")).toContainText("0")
            await expect(page.locator(".todo-count")).toContainText("items left")
        })

        test("can remove a todo", async ({ page, visitScenario }) => {
            await visitScenario(scenario)

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
            await visitScenario(scenario)

            await page.locator(".new-todo").fill("Only one")
            await page.locator(".new-todo").press("Enter")
            await expect(page.locator(".footer")).toBeVisible()

            await page.locator(".todo .destroy").click()
            await expect(page.locator(".todo-list .todo")).toHaveCount(0)
            await expect(page.locator(".footer")).not.toBeVisible()
            await expect(page.locator(".main")).not.toBeVisible()
        })

        test("can edit a todo", async ({ page, visitScenario }) => {
            await visitScenario(scenario)

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
            await visitScenario(scenario)

            await page.locator(".new-todo").fill("Original")
            await page.locator(".new-todo").press("Enter")

            await page.locator(".todo label").dblclick()
            await page.locator(".todo .edit").fill("Changed")
            await page.keyboard.press("Escape")
            await expect(page.locator(".todo")).not.toHaveClass(/editing/)
            await expect(page.locator(".todo label")).toHaveText("Original")
        })

        test("editing with empty title removes the todo", async ({ page, visitScenario }) => {
            await visitScenario(scenario)

            await page.locator(".new-todo").fill("To be deleted via edit")
            await page.locator(".new-todo").press("Enter")
            await expect(page.locator(".todo-list .todo")).toHaveCount(1)

            await page.locator(".todo label").dblclick()
            await page.locator(".todo .edit").fill("")
            await page.keyboard.press("Enter")
            await expect(page.locator(".todo-list .todo")).toHaveCount(0)
        })

        test("editing with whitespace-only title keeps todo and exits editing", async ({
            page,
            visitScenario
        }) => {
            await visitScenario(scenario)

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
            await visitScenario(scenario)

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
            await visitScenario(scenario)

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
            await visitScenario(scenario)

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

        test("switching completed to all keeps active todos visible", async ({
            page,
            visitScenario
        }) => {
            await visitScenario(scenario)

            await page.locator(".new-todo").fill("Regression todo")
            await page.locator(".new-todo").press("Enter")
            await expect(page.locator(".todo-list .todo")).toHaveCount(1)

            await page.locator('.filters a[href="#/completed"]').click()
            await expect(page.locator(".todo-list .todo")).toHaveCount(0)

            await page.locator('.filters a[href="#/all"]').click()
            await expect(page.locator(".todo-list .todo")).toHaveCount(1)
            await expect(page.locator(".todo-list .todo label")).toHaveText("Regression todo")
        })

        test("switching active to all keeps active todos visible", async ({
            page,
            visitScenario
        }) => {
            await visitScenario(scenario)

            await page.locator(".new-todo").fill("Active regression todo")
            await page.locator(".new-todo").press("Enter")
            await expect(page.locator(".todo-list .todo")).toHaveCount(1)

            await page.locator('.filters a[href="#/active"]').click()
            await expect(page.locator(".todo-list .todo")).toHaveCount(1)
            await expect(page.locator(".todo-list .todo label")).toHaveText(
                "Active regression todo"
            )

            await page.locator('.filters a[href="#/all"]').click()
            await expect(page.locator(".todo-list .todo")).toHaveCount(1)
            await expect(page.locator(".todo-list .todo label")).toHaveText(
                "Active regression todo"
            )
        })

        test("adding active todo while viewing completed keeps completed list empty", async ({
            page,
            visitScenario
        }) => {
            await visitScenario(scenario)

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
            await expect(page.locator(".todo-list .todo label").first()).toHaveText(
                "Existing active"
            )
            await expect(page.locator(".todo-list .todo label").nth(1)).toHaveText(
                "Should stay hidden in completed"
            )
        })

        test("active filter link is marked as selected", async ({ page, visitScenario }) => {
            await visitScenario(scenario)

            await expect(page.locator('.filters a[href="#/all"]')).toHaveClass(/selected/)
            await expect(page.locator('.filters a[href="#/active"]')).not.toHaveClass(/selected/)
            await expect(page.locator('.filters a[href="#/completed"]')).not.toHaveClass(/selected/)
        })

        test("completed filter hides mark-all and hides main when no completed todos", async ({
            page,
            visitScenario
        }) => {
            await visitScenario(scenario)

            await page.locator(".new-todo").fill("Only active todo")
            await page.locator(".new-todo").press("Enter")

            await page.locator('.filters a[href="#/completed"]').click()
            await expect(page.locator(".main")).not.toBeVisible()
            await expect(page.locator("#toggle-all")).not.toBeVisible()
        })

        test("completed filter keeps main visible for completed todos and hides mark-all", async ({
            page,
            visitScenario
        }) => {
            await visitScenario(scenario)

            await page.locator(".new-todo").fill("Completed one")
            await page.locator(".new-todo").press("Enter")
            await page.locator(".new-todo").fill("Active one")
            await page.locator(".new-todo").press("Enter")
            await page.locator(".todo-list .todo").first().locator(".toggle").click()

            await page.locator('.filters a[href="#/completed"]').click()
            await expect(page.locator(".main")).toBeVisible()
            await expect(page.locator(".todo-list .todo")).toHaveCount(1)
            await expect(page.locator(".todo-list .todo label")).toHaveText("Completed one")
            await expect(page.locator("#toggle-all")).not.toBeVisible()
        })

        test("mark all as completed and switch to completed shows all items", async ({
            page,
            visitScenario
        }) => {
            await visitScenario(scenario)

            await page.locator(".new-todo").fill("First todo")
            await page.locator(".new-todo").press("Enter")
            await page.locator(".new-todo").fill("Second todo")
            await page.locator(".new-todo").press("Enter")
            await expect(page.locator(".todo-list .todo")).toHaveCount(2)

            await page.locator("#toggle-all").check()
            await expect(page.locator(".todo-count")).toContainText("0")

            await page.locator('.filters a[href="#/completed"]').click()
            await expect(page.locator(".todo-list .todo")).toHaveCount(2)
            await expect(page.locator(".todo-list .todo label").first()).toHaveText("First todo")
            await expect(page.locator(".todo-list .todo label").nth(1)).toHaveText("Second todo")
        })
    })
})
