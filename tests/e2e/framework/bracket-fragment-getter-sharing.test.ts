import type { E2EPageEvaluator, E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import KeyedRow from "./components/KeyedRow"

            let x = "fallback"
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

        <section data-page="bracket-fragment-getter-sharing">
            <slot>{x}</slot>
            <KeyedRow #for={row of rows} #key={row.id} !label={row.label} />
            <button id="move" @click={moveFirstToEnd}>move</button>
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
    const readInstanceOrder = (page: E2EPageEvaluator) =>
        page.evaluate(() =>
            [...document.querySelectorAll(".row-btn")].map(btn => {
                const label = btn.nextElementSibling
                return label && label.classList.contains("row-label")
                    ? label.textContent
                    : "<broken-pair>"
            })
        )

    test("keyed component order survives a same-getter fragment instantiated earlier", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await expect(readInstanceOrder(page)).resolves.toEqual(["alpha", "beta", "gamma"])

        await page.locator("#move").click()
        await expect(readInstanceOrder(page)).resolves.toEqual(["beta", "gamma", "alpha"])
    })
})
