import type { E2EPageEvaluator, E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import KeyedRow from "./components/KeyedRow"

            let rows = [
                {
                    id: "a",
                    label: "alpha"
                },
                {
                    id: "b",
                    label: "beta"
                },
                {
                    id: "c",
                    label: "gamma"
                }
            ]

            const moveFirstToEnd = () => {
                rows = [rows[1], rows[2], rows[0]]
            }
        </lang-js>

        <section data-page="for-directive-keyed-component-order">
            <button id="move-first-to-end" @click={moveFirstToEnd}>move first to end</button>

            <KeyedRow #for={row of rows} #key={row.id} !label={row.label} />
        </section>
    `,
    components: {
        KeyedRow: `
            <button type="button" class="row-btn">
                <span class="k"></span>
            </button>
            <span class="row-label" #if={props.label}>{props.label}</span>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    // 每个组件实例由 button（根 1）与其 #if 渲染的 label（根 2）组成，
    // 读取每个 .row-btn 紧随其后的元素兄弟，验证"实例内部配对 + 实例间顺序"。
    const readInstanceOrder = (page: E2EPageEvaluator) =>
        page.evaluate(() =>
            [...document.querySelectorAll(".row-btn")].map(btn => {
                const label = btn.nextElementSibling
                return label && label.classList.contains("row-label")
                    ? label.textContent
                    : "<broken-pair>"
            })
        )

    test("renders keyed component instances in data order on mount", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator(".row-btn")).toHaveCount(3)
        await expect(page.locator(".row-label")).toHaveCount(3)
        await expect(readInstanceOrder(page)).resolves.toEqual(["alpha", "beta", "gamma"])
    })

    test("keeps keyed component instances aligned after reordering", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#move-first-to-end").click()

        await expect(page.locator(".row-btn")).toHaveCount(3)
        await expect(readInstanceOrder(page)).resolves.toEqual(["beta", "gamma", "alpha"])
    })
})
