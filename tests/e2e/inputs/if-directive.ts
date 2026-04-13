import { formatSourceCode } from "../../../src/util/shared/sundry"

import type { E2EScenario } from "#type-declarations/testing"

const ifDirectiveScenario: E2EScenario = {
    name: "if-directive",
    title: "If directive",
    readySelector: "[data-page='if-directive']",
    input: formatSourceCode(`
        <lang-js>
            import TogglePanel from "./components/TogglePanel"

            let showList = false
            let showSpread = false
            let showComponent = false
            let language = "other"
            let spreadBranch = "else"
            const items = [
                { id: 1, label: "Alpha" },
                { id: 2, label: "Beta" }
            ]

            const toggleList = () => {
                showList = !showList
            }

            const toggleSpread = () => {
                showSpread = !showSpread
            }

            const toggleComponent = () => {
                showComponent = !showComponent
            }

            const cycleLanguage = () => {
                language = language === "other"
                    ? "qk"
                    : language === "qk"
                      ? "js"
                      : language === "js"
                        ? "ts"
                        : "other"
            }

            const cycleSpreadBranch = () => {
                    spreadBranch = spreadBranch === "else"
                            ? "if"
                            : spreadBranch === "if"
                                ? "elif"
                                : "else"
            }
        </lang-js>

        <section data-page="if-directive">
            <h1 id="if-title">If directive</h1>

            <button id="toggle-list" @click={toggleList()}>Toggle list</button>
            <button id="toggle-spread" @click={toggleSpread()}>Toggle spread</button>
            <button id="toggle-component" @click={toggleComponent()}>Toggle component</button>
            <button id="cycle-language" @click={cycleLanguage()}>Cycle language</button>
            <button id="cycle-spread-branch" @click={cycleSpreadBranch()}>Cycle spread branch</button>

            <ul id="if-for-list">
                <li
                    #if={showList}
                    #for={item of items}
                    #key={item.id}
                    class="if-for-item"
                >
                    {item.label}
                </li>
            </ul>

            <div id="spread-host">
                <qk:spread #if={showSpread}>
                    Spread text
                    <p id="spread-copy">Spread copy</p>
                    <button id="spread-action">Spread action</button>
                </qk:spread>
            </div>

            <div id="spread-branch-host">
                <qk:spread #if={spreadBranch === "if"}>
                    Spread if text
                    <span id="spread-branch-if">If branch</span>
                </qk:spread>
                <qk:spread #elif={spreadBranch === "elif"}>
                    <span id="spread-branch-elif">Elif branch</span>
                    Spread elif text
                </qk:spread>
                <qk:spread #else>
                    <span id="spread-branch-else">Else branch</span>
                    Spread else text
                </qk:spread>
            </div>

            <div id="component-host">
                <TogglePanel #if={showComponent} />
                <p #else id="component-fallback">Component fallback</p>
            </div>

            <div id="language-branch">
                <p #if={language === "qk"} id="lang-qk">Qingkuai</p>
                <p #elif={language === "js"} id="lang-js">JavaScript</p>
                <p #elif={language === "ts"} id="lang-ts">TypeScript</p>
                <p #else id="lang-other">Other language</p>
            </div>
        </section>
    `),
    components: {
        TogglePanel: formatSourceCode(`
            <div id="component-content">Component content</div>
        `)
    }
}

export default ifDirectiveScenario
