import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import { getCurrentInstance, getContexts } from "qingkuai"
            import { captureInstance, writeContext } from "./modules/context-registry.js"
            import ContextCard from "./components/ContextCard"
            import ContextBadge from "./components/ContextBadge"
            import ModeBadge from "./components/ModeBadge"
            import ThemePanel from "./components/ThemePanel"

            defaults({
                contexts: {
                    fallback: "default-fallback",
                    solo: "default-solo"
                }
            })

            setContext("user", "parent-user")
            setContext("theme", "dark")
            setContext("solo")
            setContext("fn", () => "computed")

            let mode = reactive("light")
            setContextExp("mode", mode)

            effect(() => {
                globalThis.__seenMode = contexts.mode
            })

            let refresh = reactive(0)
            let version = reactive(0)

            const toggleMode = () => {
                mode = "dark"
            }

            const applyFallback = () => {
                setContext("fallback", "custom-fallback")
                refresh++
            }

            const setUserTwice = () => {
                setContext("user", "temp-user")
                setContext("user", "final-user")
                refresh++
            }

            const writeAsync = () => {
                writeContext("user", "async-user")
                version++
            }

            onAfterMount(() => {
                captureInstance(getCurrentInstance)
                globalThis.__rootContexts = getContexts(getCurrentInstance())
            })
        </lang-js>

        <section data-page="component-context">
            <h1 id="context-title">Component Context</h1>

            <p id="app-user">App user: {contexts.user}</p>
            <p id="app-theme">App theme: {contexts.theme}</p>

            <ContextCard />
            <ContextBadge />
            <ModeBadge />

            <ThemePanel />
            <button id="btn-toggle-mode" @click={toggleMode}>Toggle mode</button>

            <p id="fallback-value">Fallback: {contexts.fallback} / r{refresh}</p>
            <p id="solo-value">Solo: {contexts.solo}</p>
            <p id="fn-type">Fn type: {typeof contexts.fn}</p>
            <p id="reuser-value">Reuser: {contexts.user} / r{refresh}</p>
            <button id="btn-set-user-twice" @click={setUserTwice}>Set user twice</button>
            <p id="refresh-value">Refresh: {refresh}</p>
            <button id="btn-apply-fallback" @click={applyFallback}>Apply fallback</button>

            <p id="async-user">Async user: {contexts.user} / v{version}</p>
            <p id="version-value">Version: {version}</p>
            <button id="btn-write-async" @click={writeAsync}>Write async</button>
        </section>
    `,
    components: {
        ContextCard: `
            <lang-js>
                import ContextFooter from "./ContextFooter"
            </lang-js>

            <article id="context-card">
                <p id="card-user">Card user: {contexts.user}</p>
                <ContextFooter />
            </article>
        `,
        ContextFooter: `
            <p id="footer-user">Footer user: {contexts.user}</p>
            <p id="footer-solo">Footer solo: {contexts.solo}</p>
        `,
        ContextBadge: `
            <lang-js>
                setContext("user", "badge-user")
            </lang-js>

            <span id="badge-user">Badge user: {contexts.user}</span>
        `,
        ModeBadge: `
            <lang-js>
                let localMode = reactive("local")
                setContextExp("mode", localMode)
            </lang-js>

            <span id="badge-mode">Badge mode: {contexts.mode}</span>
        `,
        ThemePanel: `
            <p id="theme-panel" !data-mode={contexts.mode}>Panel theme: {contexts.mode}</p>
        `
    },
    modules: {
        "context-registry": `
            import { setContext } from "qingkuai"

            export function captureInstance(getCurrentInstance) {
                const inst = getCurrentInstance()
                globalThis.__contextInstance = inst
                return inst
            }

            export function writeContext(key, value) {
                setContext(globalThis.__contextInstance, key, value)
            }
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("child and grandchild components inherit parent contexts", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#app-user")).toHaveText("App user: parent-user")
        await expect(page.locator("#app-theme")).toHaveText("App theme: dark")
        await expect(page.locator("#card-user")).toHaveText("Card user: parent-user")
        await expect(page.locator("#footer-user")).toHaveText("Footer user: parent-user")
    })

    test("child setContext shadows the parent key without affecting the parent", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#badge-user")).toHaveText("Badge user: badge-user")
        await expect(page.locator("#card-user")).toHaveText("Card user: parent-user")
        await expect(page.locator("#app-user")).toHaveText("App user: parent-user")
    })

    test("setContextExp keeps template contexts reactive across components", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#theme-panel")).toHaveText("Panel theme: light")

        await page.locator("#btn-toggle-mode").click()
        await expect(page.locator("#theme-panel")).toHaveText("Panel theme: dark")
    })

    test("setContextExp in a child shadows the parent key without affecting it", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        // 子组件 setContextExp 遮蔽父级同名 key，父级值不受影响。
        // The child's setContextExp shadows the parent key; the parent value is unaffected.
        await expect(page.locator("#badge-mode")).toHaveText("Badge mode: local")
        await expect(page.locator("#theme-panel")).toHaveText("Panel theme: light")

        // 父级响应式值变化不影响被遮蔽的子级。
        // Changing the parent reactive value does not affect the shadowed child.
        await page.locator("#btn-toggle-mode").click()
        await expect(page.locator("#theme-panel")).toHaveText("Panel theme: dark")
        await expect(page.locator("#badge-mode")).toHaveText("Badge mode: local")
    })

    test("reading contexts inside an effect tracks the reactive value", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const readSeenMode = () => page.evaluate(() => (globalThis as any).__seenMode)

        await expect.poll(readSeenMode).toBe("light")

        await page.locator("#btn-toggle-mode").click()
        await expect.poll(readSeenMode).toBe("dark")
    })

    test("contexts in dynamic attributes stay reactive across components", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#theme-panel")).toHaveAttribute("data-mode", "light")

        await page.locator("#btn-toggle-mode").click()
        await expect(page.locator("#theme-panel")).toHaveAttribute("data-mode", "dark")
    })

    test("plain function values are stored as-is and never invoked on read", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        // 普通函数值原样存储，读取时不调用（若被调用会显示 "computed"）。
        // A plain function value is stored as-is and not invoked on read.
        await expect(page.locator("#fn-type")).toHaveText("Fn type: function")
    })

    test("re-setting the same key applies the last write", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#reuser-value")).toHaveText("Reuser: parent-user / r0")

        await page.locator("#btn-set-user-twice").click()
        // 同 key 连续写入两次，最后一次生效。
        // Writing the same key twice applies the last write.
        await expect(page.locator("#reuser-value")).toHaveText("Reuser: final-user / r1")
    })

    test("defaults provide context values until setContext overrides them", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#fallback-value")).toHaveText("Fallback: default-fallback / r0")

        await page.locator("#btn-apply-fallback").click()
        await expect(page.locator("#fallback-value")).toHaveText("Fallback: custom-fallback / r1")
    })

    test("setContext with only a key falls back to the defaults value", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#solo-value")).toHaveText("Solo: default-solo")
        await expect(page.locator("#footer-solo")).toHaveText("Footer solo: default-solo")
    })

    test("async setContext from an external module takes effect on the next render", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#async-user")).toHaveText("Async user: parent-user / v0")

        await page.locator("#btn-write-async").click()
        await expect(page.locator("#async-user")).toHaveText("Async user: async-user / v1")
    })

    test("root component contexts object has no prototype", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        const proto = await page.evaluate(() =>
            Object.getPrototypeOf((globalThis as any).__rootContexts)
        )
        expect(proto).toBeNull()
    })
})
