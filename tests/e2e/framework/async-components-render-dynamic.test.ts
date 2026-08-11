import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let CurrentView = import("./components/AsyncOne")

            let probe = "idle"

            const setSlowOne = () => {
                probe = "idle"
                CurrentView = new Promise(resolve => {
                    setTimeout(() => {
                        probe = "one-resolved"
                        resolve(import("./components/AsyncOne"))
                    }, 40)
                })
            }

            const setFastTwo = () => {
                CurrentView = import("./components/AsyncTwo")
            }

            const setSlowTwo = () => {
                probe = "idle"
                CurrentView = new Promise(resolve => {
                    setTimeout(() => {
                        probe = "two-resolved"
                        resolve(import("./components/AsyncTwo"))
                    }, 40)
                })
            }

            const setFastOne = () => {
                CurrentView = import("./components/AsyncOne")
            }
        </lang-js>

        <section data-page="async-components-render-dynamic">
            <h1 id="title">Async Components Dynamic Render</h1>
            <p id="probe">{probe}</p>
            <button id="set-slow-one" @click={setSlowOne}>Set one (slow)</button>
            <button id="set-fast-two" @click={setFastTwo}>Set two (fast)</button>
            <button id="set-slow-two" @click={setSlowTwo}>Set two (slow)</button>
            <button id="set-fast-one" @click={setFastOne}>Set one (fast)</button>
            <CurrentView />
        </section>
    `,
    components: {
        AsyncOne: `<article id="async-one">Async One</article>`,
        AsyncTwo: `<article id="async-two">Async Two</article>`
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("renders the initial async component directly", async ({ page, visitScenario }) => {
        await visitScenario(scenario)
        await expect(page).toHaveTitle("async-components-render-dynamic")
        await expect(page.locator("#async-one")).toHaveText("Async One")
    })

    test("ignores a stale slow component resolved after switching to a fast one", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        // 切到慢 One（pending），随即切到快 Two 并渲染（旧的 One 渲染被替换销毁）
        // Switch to slow One (pending), then switch to fast Two and render (the old One render is replaced and destroyed)
        await page.locator("#set-slow-one").click()
        await page.locator("#set-fast-two").click()
        await expect(page.locator("#async-two")).toHaveText("Async Two")

        // 慢 One resolve 后不应覆盖 Two（静默跳过）
        // After slow One resolves, it should not overwrite Two (silently skip)
        await expect(page.locator("#probe")).toHaveText("one-resolved")
        await expect(page.locator("#async-one")).toHaveCount(0)
        await expect(page.locator("#async-two")).toHaveText("Async Two")
    })

    test("renders a slow component switched in after a fast one resolved", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#set-fast-two").click()
        await expect(page.locator("#async-two")).toHaveText("Async Two")

        // 切到慢 One：旧的 Two 被替换销毁
        // Switch to slow One: the old Two is replaced and destroyed
        await page.locator("#set-slow-one").click()
        await expect(page.locator("#async-two")).toHaveCount(0)

        // One resolve 后渲染
        // After One resolves, it renders
        await expect(page.locator("#async-one")).toHaveText("Async One")
    })

    test("multiple rapid switches keep the latest component", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#set-slow-one").click()
        await page.locator("#set-fast-two").click()
        await page.locator("#set-fast-one").click()

        // 最新是快 One
        // The latest is fast One
        await expect(page.locator("#async-one")).toHaveText("Async One")
        await expect(page.locator("#async-two")).toHaveCount(0)

        // 慢 One resolve 后（probe 置位）也不应覆盖
        // After slow One resolves (probe set), it should not overwrite
        await expect(page.locator("#probe")).toHaveText("one-resolved")
        await expect(page.locator("#async-one")).toHaveText("Async One")
        await expect(page.locator("#async-two")).toHaveCount(0)
    })
})
