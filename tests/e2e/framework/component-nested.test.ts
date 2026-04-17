import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import ParentShell from "./components/layout/ParentShell"
        </lang-js>

        <section data-page="component-nested">
            <h1 id="component-nested-title">Component Nested</h1>
            <ParentShell !title={"Outer shell"} />
        </section>
    `,
    components: {
        "layout/ParentShell": `
            <lang-js>
                import ChildBadge from "./ChildBadge"
            </lang-js>

            <section id="parent-shell">
                <h2 id="parent-shell-title">{props.title}</h2>
                <ChildBadge !text={"Inner badge"} />
            </section>
        `,
        "layout/ChildBadge": `
            <lang-js>
                import TinyFlag from "./TinyFlag"
            </lang-js>

            <article id="child-badge">
                <p id="child-badge-text">{props.text}</p>
                <TinyFlag !kind={"deep nested"} />
            </article>
        `,
        "layout/TinyFlag": `
            <span id="tiny-flag">{props.kind}</span>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports nested component rendering", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#component-nested-title")).toHaveText("Component Nested")
        await expect(page.locator("#parent-shell-title")).toHaveText("Outer shell")
        await expect(page.locator("#child-badge-text")).toHaveText("Inner badge")
        await expect(page.locator("#tiny-flag")).toHaveText("deep nested")
    })
})
