import { formatSourceCode } from "../../../src/util/shared/sundry"

import type { E2EScenario } from "#type-declarations/testing"

const todoMvcScenario: E2EScenario = {
    name: "todo-mvc",
    title: "TodoMVC",
    readySelector: "[data-page='todo-mvc']",
    compileOptions: { whitespace: "collapse" },
    input: formatSourceCode(`
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
                            &dom={editInputs[index]}
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
    `)
}

export default todoMvcScenario
