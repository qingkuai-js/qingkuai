import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import AsyncOne from "./components/AsyncOne"

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

            const rejectTwo = () => {
                deferredMap[2].handlers.reject("two failed")
            }

            const resetTwo = () => {
                const deferred = createDeferred()
                deferredMap[2] = deferred
                list = list.map(item => {
                    if (item.id === 2) {
                        return {
                            id: item.id,
                            label: item.label,
                            promise: deferred.promise
                        }
                    }
                    return item
                })
            }
        </lang-js>

        <section data-page="async-components-for-independent-states">
            <button id="resolve-one" @click={resolveOne()}>Resolve one</button>
            <button id="reject-two" @click={rejectTwo()}>Reject two</button>
            <button id="reset-two" @click={resetTwo()}>Reset two</button>

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
        AsyncOne: `<article id="async-one">Async One</article>`
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports for items with independent async component states", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#async-for-list .async-item-label")).toHaveText(["one", "two"])
        await expect(page.locator("#async-for-list .async-item-loading")).toHaveText([
            "Loading one",
            "Loading two"
        ])

        await page.locator("#resolve-one").click()
        await expect(page.locator("#async-for-list #async-one")).toHaveText("Async One")
        await expect(page.locator("#async-for-list .async-item-loading")).toHaveText([
            "Loading two"
        ])

        await page.locator("#reject-two").click()
        await expect(page.locator("#async-for-list .async-item-error")).toHaveText([
            "two: two failed"
        ])

        await page.locator("#reset-two").click()
        await expect(page.locator("#async-for-list .async-item-loading")).toHaveText([
            "Loading two"
        ])
        await expect(page.locator("#async-for-list .async-item-error")).toHaveCount(0)
    })
})
