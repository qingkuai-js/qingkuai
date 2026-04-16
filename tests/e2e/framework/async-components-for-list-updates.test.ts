import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import AsyncOne from "./components/AsyncOne"
            import AsyncThree from "./components/AsyncThree"

            const createDeferred = () => {
                const handlers = {
                    resolve: () => {},
                    reject: () => {}
                }
                const promise = new Promise((resolve, reject) => {
                    handlers.resolve = resolve
                    handlers.reject = reject
                })
                return {
                    handlers,
                    promise
                }
            }

            const deferredMap = {}

            const createItem = (id, label) => {
                const deferred = createDeferred()
                deferredMap[id] = deferred
                return {
                    id,
                    label,
                    promise: deferred.promise
                }
            }

            let list = [createItem(1, "one"), createItem(2, "two")]

            const resolveOne = () => {
                deferredMap[1].handlers.resolve(AsyncOne)
            }

            const removeFirst = () => {
                list = list.slice(1)
            }

            const addThird = () => {
                list = [...list, createItem(3, "three")]
            }

            const resolveThree = () => {
                deferredMap[3].handlers.resolve(AsyncThree)
            }
        </lang-js>

        <section data-page="async-components-for-list-updates">
            <button id="resolve-one" @click={resolveOne()}>Resolve one</button>
            <button id="remove-first" @click={removeFirst()}>Remove first</button>
            <button id="add-third" @click={addThird()}>Add third</button>
            <button id="resolve-three" @click={resolveThree()}>Resolve three</button>

            <ul id="async-for-list">
                <li
                    class="async-item"
                    #for={item of list}
                    #key={item.id}
                >
                    <span class="async-item-label">{item.label}</span>
                    <p
                        class="async-item-loading"
                        #await={item.promise}
                    >
                        Loading {item.label}
                    </p>
                    <qk:spread #then={LoadedComponent}>
                        <LoadedComponent />
                    </qk:spread>
                    <p
                        class="async-item-error"
                        #catch={err}
                    >
                        {item.label}: {err}
                    </p>
                </li>
            </ul>
        </section>
    `,
    components: {
        AsyncOne: `<article id="async-one">Async One</article>`,
        AsyncThree: `<article id="async-three">Async Three</article>`
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports for list updates while async component branches are active", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#resolve-one").click()
        await expect(page.locator("#async-for-list #async-one")).toHaveText("Async One")

        await page.locator("#remove-first").click()
        await expect(page.locator("#async-for-list .async-item-label")).toHaveText(["two"])
        await expect(page.locator("#async-for-list #async-one")).toHaveCount(0)
        await expect(page.locator("#async-for-list .async-item-loading")).toHaveText([
            "Loading two"
        ])

        await page.locator("#add-third").click()
        await expect(page.locator("#async-for-list .async-item-label")).toHaveText(["two", "three"])
        await expect(page.locator("#async-for-list .async-item-loading")).toHaveText([
            "Loading two",
            "Loading three"
        ])

        await page.locator("#resolve-three").click()
        await expect(page.locator("#async-for-list #async-three")).toHaveText("Async Three")
    })
})
