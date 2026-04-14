import { formatSourceCode } from "../../../src/util/shared/sundry"

import type { E2EScenario } from "#type-declarations/testing"

const targetDirectiveScenario: E2EScenario = {
    name: "target-directive",
    title: "Target directive",
    readySelector: "[data-page='target-directive']",
    input: formatSourceCode(`
        <lang-js>
            import TargetPanel from "./components/TargetPanel"

            const createPendingPromise = () => new Promise(() => {})

            let targetSelector = null
            let teleportLabel = "Initial content"
            let spreadTarget = null
            let componentTarget = null
            let componentTagTarget = null
            let ifTarget = null
            let showIfTarget = true
            let forTarget = null
            let forItems = [
                { id: 1, label: "For A" },
                { id: 2, label: "For B" }
            ]
            let awaitTarget = null
            let awaitValuePromise = createPendingPromise()
            let destA
            let destB
            let delayedTarget = null
            let delayedTargetPromise = createPendingPromise()

            const teleportToA = () => {
                targetSelector = "#target-dest-a"
            }

            const teleportToB = () => {
                targetSelector = "#target-dest-b"
            }

            const resetInline = () => {
                targetSelector = null
            }

            const updateLabel = () => {
                teleportLabel = "Updated content"
            }

            const resetLabel = () => {
                teleportLabel = "Initial content"
            }

            const moveSpreadToA = () => {
                spreadTarget = "#target-dest-a"
            }

            const resetSpreadInline = () => {
                spreadTarget = null
            }

            const moveComponentToB = () => {
                componentTarget = "#target-dest-b"
            }

            const resetComponentInline = () => {
                componentTarget = null
            }

            const moveComponentTagToA = () => {
                componentTagTarget = "#target-dest-a"
            }

            const resetComponentTagInline = () => {
                componentTagTarget = null
            }

            const moveIfToA = () => {
                ifTarget = "#target-dest-a"
            }

            const toggleIfTarget = () => {
                showIfTarget = !showIfTarget
            }

            const moveForToB = () => {
                forTarget = "#target-dest-b"
            }

            const appendForItem = () => {
                forItems.push({
                    id: forItems.length + 1,
                    label: "For " + String.fromCharCode(64 + forItems.length + 1)
                })
            }

            const moveAwaitToA = () => {
                awaitTarget = "#target-dest-a"
            }

            const resetAwaitBranch = () => {
                awaitValuePromise = createPendingPromise()
            }

            const resolveAwaitBranch = () => {
                awaitValuePromise = new Promise(resolve => {
                    setTimeout(() => resolve("Await resolved"), 10)
                })
            }

            const resolveDelayedTarget = () => {
                delayedTargetPromise = new Promise(resolve => {
                    setTimeout(() => resolve("Delayed destination ready"), 10)
                })
            }

            const resetDelayedTarget = () => {
                delayedTargetPromise = createPendingPromise()
                delayedTarget = null
            }

            const teleportToDelayedTarget = () => {
                delayedTarget = "#target-delayed-dest"
            }
        </lang-js>

        <section data-page="target-directive">
            <h1 id="target-title">Target directive</h1>

            <div>
                <button id="target-to-a" @click={teleportToA()}>Teleport to A</button>
                <button id="target-to-b" @click={teleportToB()}>Teleport to B</button>
                <button id="target-reset" @click={resetInline()}>Reset inline</button>
                <button id="target-update-label" @click={updateLabel()}>Update label</button>
                <button id="target-reset-label" @click={resetLabel()}>Reset label</button>
            </div>

            <div id="target-source-container">
                <div #target={targetSelector}>
                    <p id="target-content">{teleportLabel}</p>
                </div>
            </div>

            <div>
                <button id="target-spread-to-a" @click={moveSpreadToA()}>Spread to A</button>
                <button id="target-spread-reset" @click={resetSpreadInline()}>Spread reset</button>
            </div>
            <div id="target-spread-source">
                <qk:spread #target={spreadTarget}>
                    <span class="target-spread-item">Spread One</span>
                    <span class="target-spread-item">Spread Two</span>
                </qk:spread>
            </div>

            <div>
                <button id="target-component-to-b" @click={moveComponentToB()}>Component to B</button>
                <button id="target-component-reset" @click={resetComponentInline()}>Component reset</button>
            </div>
            <div id="target-component-source">
                <div #target={componentTarget}>
                    <TargetPanel>
                        <span id="target-component-content">Component payload</span>
                    </TargetPanel>
                </div>
            </div>

            <div>
                <button id="target-component-tag-to-a" @click={moveComponentTagToA()}>Component tag to A</button>
                <button id="target-component-tag-reset" @click={resetComponentTagInline()}>Component tag reset</button>
            </div>
            <div id="target-component-tag-source">
                <TargetPanel #target={componentTagTarget}>
                    <span id="target-component-tag-content">Component tag payload</span>
                </TargetPanel>
            </div>

            <div>
                <button id="target-if-to-a" @click={moveIfToA()}>If to A</button>
                <button id="target-if-toggle" @click={toggleIfTarget()}>Toggle if</button>
            </div>
            <div id="target-if-source">
                <p id="target-if-content" #if={showIfTarget} #target={ifTarget}>If payload</p>
            </div>

            <div>
                <button id="target-for-to-b" @click={moveForToB()}>For to B</button>
                <button id="target-for-append" @click={appendForItem()}>For append</button>
            </div>
            <div id="target-for-source">
                <p
                    #for={item of forItems}
                    #key={item.id}
                >
                    <span #target={forTarget} class="target-for-item">{item.label}</span>
                </p>
            </div>

            <div>
                <button id="target-await-to-a" @click={moveAwaitToA()}>Await to A</button>
                <button id="target-await-reset" @click={resetAwaitBranch()}>Await reset</button>
                <button id="target-await-resolve" @click={resolveAwaitBranch()}>Await resolve</button>
            </div>
            <div id="target-await-source">
                <p id="target-await-pending" #await={awaitValuePromise} #target={awaitTarget}>Await pending</p>
                <p id="target-await-then" #then={msg} #target={awaitTarget}>{msg}</p>
                <p id="target-await-catch" #catch={err} #target={awaitTarget}>{err}</p>
            </div>

            <div>
                <button id="target-delayed-resolve" @click={resolveDelayedTarget()}>Resolve delayed dest</button>
                <button id="target-delayed-teleport" @click={teleportToDelayedTarget()}>Teleport delayed</button>
                <button id="target-delayed-reset" @click={resetDelayedTarget()}>Reset delayed</button>
            </div>
            <div id="target-delayed-source">
                <p id="target-delayed-content" #target={delayedTarget}>Delayed payload</p>
            </div>
            <div id="target-delayed-await-host">
                <p id="target-delayed-await-pending" #await={delayedTargetPromise}>Waiting delayed destination</p>
                <div #then={msg}>
                    <div id="target-delayed-dest">{msg}</div>
                </div>
                <p id="target-delayed-await-catch" #catch={err}>{err}</p>
            </div>

            <div id="target-dest-a" &dom={destA}></div>
            <div id="target-dest-b" &dom={destB}></div>
        </section>
    `),
    components: {
        TargetPanel: formatSourceCode(`
            <article class="target-panel">
                <slot></slot>
            </article>
        `)
    }
}

export default targetDirectiveScenario
