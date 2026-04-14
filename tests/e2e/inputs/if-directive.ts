import { formatSourceCode } from "../../../src/util/shared/sundry"

import type { E2EScenario } from "#type-declarations/testing"

const ifDirectiveScenario: E2EScenario = {
    name: "if-directive",
    title: "If directive",
    readySelector: "[data-page='if-directive']",
    input: formatSourceCode(`
        <lang-js>
            import TogglePanel from "./components/TogglePanel"
            import ToggleOrderPanel from "./components/ToggleOrderPanel"
            import IfChainIfPanel from "./components/IfChainIfPanel"
            import IfChainElifPanel from "./components/IfChainElifPanel"
            import IfChainElsePanel from "./components/IfChainElsePanel"

            let showList = false
            let showSpread = false
            let showComponent = false
            let language = "other"
            let spreadBranch = "else"
            let componentBranch = "else"
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

            const cycleComponentBranch = () => {
                componentBranch = componentBranch === "else"
                    ? "if"
                    : componentBranch === "if"
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
            <button id="cycle-component-branch" @click={cycleComponentBranch()}>Cycle component branch</button>

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

            <div id="component-order-host">
                <span class="component-order-marker">Before</span>
                <ToggleOrderPanel #if={showComponent} />
                <span class="component-order-marker">After</span>
            </div>

            <div id="component-chain-host">
                <span class="component-chain-marker">Before chain</span>
                <IfChainIfPanel #if={componentBranch === "if"} />
                <IfChainElifPanel #elif={componentBranch === "elif"} />
                <IfChainElsePanel #else />
                <span class="component-chain-marker">After chain</span>
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
        `),
        ToggleOrderPanel: formatSourceCode(`
            <div id="component-order-content">Component content</div>
        `),
        IfChainIfPanel: formatSourceCode(`
            <div id="component-chain-if">Component if branch</div>
        `),
        IfChainElifPanel: formatSourceCode(`
            <div id="component-chain-elif">Component elif branch</div>
        `),
        IfChainElsePanel: formatSourceCode(`
            <div id="component-chain-else">Component else branch</div>
        `)
    }
}

export default ifDirectiveScenario
