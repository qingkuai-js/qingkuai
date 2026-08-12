import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let mode = "primary"
            let extra = ["shadow", "rounded"]
            let flags = { active: true, disabled: false }

            const setDark = () => {
                mode = "dark"
            }

            const addExtra = () => {
                extra = ["shadow", "rounded", "outline"]
            }

            const flipFlags = () => {
                flags = { active: false, disabled: true }
            }
        </lang-js>

        <section data-page="attribute-dynamic-class">
            <h1 id="title">Dynamic Class Binding</h1>

            <div id="str" !class={mode}></div>
            <div id="arr" !class={extra}></div>
            <div id="obj" !class={flags}></div>

            <div id="combo-str" class="base" !class={mode}></div>
            <div id="combo-arr" class="base" !class={extra}></div>
            <div id="combo-obj" class="base" !class={flags}></div>

            <button id="btn-dark" @click={setDark}>Dark mode</button>
            <button id="btn-extra" @click={addExtra}>Add extra</button>
            <button id="btn-flip" @click={flipFlags}>Flip flags</button>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("dynamic class supports string values", async ({ page, visitScenario }) => {
        await visitScenario(scenario)
        await expect(page.locator("#str")).toHaveClass("primary")

        await page.locator("#btn-dark").click()
        await expect(page.locator("#str")).toHaveClass("dark")
    })

    test("dynamic class supports array values", async ({ page, visitScenario }) => {
        await visitScenario(scenario)
        await expect(page.locator("#arr")).toHaveClass("shadow rounded")

        await page.locator("#btn-extra").click()
        await expect(page.locator("#arr")).toHaveClass("shadow rounded outline")
    })

    test("dynamic class supports object values (truthy keys win)", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await expect(page.locator("#obj")).toHaveClass("active")

        await page.locator("#btn-flip").click()
        await expect(page.locator("#obj")).toHaveClass("disabled")
    })

    test("static class merges with dynamic string class", async ({ page, visitScenario }) => {
        await visitScenario(scenario)
        await expect(page.locator("#combo-str")).toHaveClass("base primary")

        await page.locator("#btn-dark").click()
        await expect(page.locator("#combo-str")).toHaveClass("base dark")
    })

    test("static class merges with dynamic array class", async ({ page, visitScenario }) => {
        await visitScenario(scenario)
        await expect(page.locator("#combo-arr")).toHaveClass("base shadow rounded")

        await page.locator("#btn-extra").click()
        await expect(page.locator("#combo-arr")).toHaveClass("base shadow rounded outline")
    })

    test("static class merges with dynamic object class", async ({ page, visitScenario }) => {
        await visitScenario(scenario)
        await expect(page.locator("#combo-obj")).toHaveClass("base active")

        await page.locator("#btn-flip").click()
        await expect(page.locator("#combo-obj")).toHaveClass("base disabled")
    })
})
