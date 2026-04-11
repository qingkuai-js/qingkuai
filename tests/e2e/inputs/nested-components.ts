import { formatSourceCode } from "../../../src/util/shared/sundry"

import type { E2EScenario } from "#type-declarations/testing"

const nestedComponentsScenario: E2EScenario = {
    name: "nested-components",
    title: "Nested components",
    readySelector: "[data-page='nested-root']",
    input: formatSourceCode(`
        <lang-js>
            import Panel from "./components/layout/Panel"
        </lang-js>

        <section data-page="nested-root">
            <h1 id="nested-title">Nested Components</h1>
            <Panel />
        </section>
    `),
    components: {
        "layout/Panel": formatSourceCode(`
            <lang-js>
                import Leaf from "./Leaf"
            </lang-js>

            <div id="nested-panel">
                <Leaf />
            </div>
        `),
        "layout/Leaf": formatSourceCode(`
            <p id="nested-leaf">Nested Leaf</p>
        `)
    }
}

export default nestedComponentsScenario
