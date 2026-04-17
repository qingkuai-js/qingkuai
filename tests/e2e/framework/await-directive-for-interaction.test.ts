import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            const createDeferred = () => {
                const handlers = {
                    resolve: () => {},
                    reject: () => {}
                }
                const promise = new Promise((resolve, reject) => {
                    handlers.resolve = resolve
                    handlers.reject = reject
                })
                return { handlers, promise }
            }

            const deferredMap = {}

            const createItem = (id, label) => {
                const deferred = createDeferred()
                deferredMap[id] = deferred
                return { id, label, promise: deferred.promise }
            }

            let items = [createItem(1, "alpha"), createItem(2, "beta")]

            const resolveItem = (id) => {
                deferredMap[id].handlers.resolve(\`resolved \${id}\`)
            }

            const rejectItem = (id) => {
                deferredMap[id].handlers.reject(\`error \${id}\`)
            }
        </lang-js>

        <section data-page="await-directive-for-interaction">
            <button id="resolve-1" @click={resolveItem(1)}>Resolve 1</button>
            <button id="reject-2" @click={rejectItem(2)}>Reject 2</button>

            <ul id="item-list">
                <li
                    #for={item of items}
                    #key={item.id}
                    class="item"
                >
                    <span class="item-label">{item.label}</span>
                    <p class="item-pending" #await={item.promise}>
                        Waiting {item.label}...
                    </p>
                    <p class="item-resolved" #then={res}>
                        {res}
                    </p>
                    <p class="item-error" #catch={err}>
                        {err}
                    </p>
                </li>
            </ul>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports await directive within for loop items", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#item-list .item-label")).toHaveText(["alpha", "beta"])
        await expect(page.locator("#item-list .item-pending")).toHaveText([
            "Waiting alpha...",
            "Waiting beta..."
        ])

        await page.locator("#resolve-1").click()
        await expect(page.locator("#item-list .item-resolved")).toContainText("resolved 1")
        await expect(page.locator("#item-list .item-pending")).toHaveCount(1)

        await page.locator("#reject-2").click()
        await expect(page.locator("#item-list .item-error")).toContainText("error 2")
        await expect(page.locator("#item-list .item-pending")).toHaveCount(0)
    })
})
