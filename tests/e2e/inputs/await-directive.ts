import { formatSourceCode } from "../../../src/util/shared/sundry"

import type { E2EScenario } from "#type-declarations/testing"

const awaitDirectiveScenario: E2EScenario = {
    name: "await-directive",
    title: "Await directive",
    readySelector: "[data-page='await-directive']",
    input: formatSourceCode(`
        <lang-js>
            const createPendingPromise = () => new Promise(() => {})

            let branchPromise = createPendingPromise()
            let inlineResolvePromise = createPendingPromise()
            let inlineRejectPromise = createPendingPromise()
            let spreadPromise = createPendingPromise()
            let structuredPromise = createPendingPromise()
            let priorityPromise = createPendingPromise()
            let showPriorityPending = false

            const resetBranch = () => {
                branchPromise = createPendingPromise()
            }

            const resolveBranch = () => {
                branchPromise = new Promise(resolve => {
                    setTimeout(() => resolve({ id: 7, name: "Qingkuai" }), 10)
                })
            }

            const rejectBranch = () => {
                branchPromise = new Promise((_, reject) => {
                    setTimeout(() => reject({ msg: "branch failed", code: 500 }), 10)
                })
            }

            const resetInlineResolve = () => {
                inlineResolvePromise = createPendingPromise()
            }

            const resolveInline = () => {
                inlineResolvePromise = new Promise(resolve => {
                    setTimeout(() => resolve("inline done"), 10)
                })
            }

            const resetInlineReject = () => {
                inlineRejectPromise = createPendingPromise()
            }

            const rejectInline = () => {
                inlineRejectPromise = new Promise((_, reject) => {
                    setTimeout(() => reject("inline failed"), 10)
                })
            }

            const resetSpread = () => {
                spreadPromise = createPendingPromise()
            }

            const resolveSpread = () => {
                spreadPromise = new Promise(resolve => {
                    setTimeout(() => resolve({ label: "Spread resolved", extra: "OK" }), 10)
                })
            }

            const rejectSpread = () => {
                spreadPromise = new Promise((_, reject) => {
                    setTimeout(() => reject({ msg: "spread failed", code: 503 }), 10)
                })
            }

            const resetStructured = () => {
                structuredPromise = createPendingPromise()
            }

            const resolveStructured = () => {
                structuredPromise = new Promise(resolve => {
                    setTimeout(() => resolve({ id: 12, name: "Structured" }), 10)
                })
            }

            const rejectStructured = () => {
                structuredPromise = new Promise((_, reject) => {
                    setTimeout(() => reject({ msg: "structured failed", code: 418 }), 10)
                })
            }

            const resetPriority = () => {
                priorityPromise = createPendingPromise()
            }

            const resolvePriority = () => {
                priorityPromise = new Promise(resolve => {
                    setTimeout(() => resolve("priority resolved"), 10)
                })
            }

            const togglePriorityIf = () => {
                showPriorityPending = !showPriorityPending
            }
        </lang-js>

        <section data-page="await-directive">
            <h1 id="await-title">Await directive</h1>

            <div>
                <button id="branch-reset" @click={resetBranch()}>Reset branch</button>
                <button id="branch-resolve" @click={resolveBranch()}>Resolve branch</button>
                <button id="branch-reject" @click={rejectBranch()}>Reject branch</button>
            </div>
            <div id="branch-block">
                <p id="branch-await" #await={branchPromise}>Loading branch...</p>
                <p
                    id="branch-then"
                    #then={{ id: userId, name: userName }}
                >
                    Resolved user {userId}: {userName}
                </p>
                <p id="branch-catch" #catch={{msg, code}}>Rejected {code}: {msg}</p>
            </div>

            <div>
                <button id="inline-resolve-reset" @click={resetInlineResolve()}>Reset inline resolve</button>
                <button id="inline-resolve-trigger" @click={resolveInline()}>Resolve inline</button>
            </div>
            <div id="inline-resolve-block">
                <p
                    id="inline-then"
                    #await={inlineResolvePromise}
                    #then={res}
                >
                    Inline resolved: {res}
                </p>
            </div>

            <div>
                <button id="inline-reject-reset" @click={resetInlineReject()}>Reset inline reject</button>
                <button id="inline-reject-trigger" @click={rejectInline()}>Reject inline</button>
            </div>
            <div id="inline-reject-block">
                <p
                    id="inline-catch"
                    #await={inlineRejectPromise}
                    #catch={err}
                >
                    Inline rejected: {err}
                </p>
            </div>

            <div>
                <button id="spread-reset" @click={resetSpread()}>Reset spread</button>
                <button id="spread-resolve" @click={resolveSpread()}>Resolve spread</button>
                <button id="spread-reject" @click={rejectSpread()}>Reject spread</button>
            </div>
            <div id="spread-block">
                <qk:spread #await={spreadPromise}>
                    Spread waiting
                    <span id="spread-await-copy">Spread pending</span>
                </qk:spread>
                <qk:spread #then={{ label, extra }}>
                    Spread then text
                    <span id="spread-then-label">{label}</span>
                    <strong id="spread-then-extra">{extra}</strong>
                </qk:spread>
                <qk:spread #catch={{ msg, code }}>
                    <span id="spread-catch-msg">{msg}</span>
                    Spread catch text
                    <strong id="spread-catch-code">{code}</strong>
                </qk:spread>
            </div>

            <div>
                <button id="structured-reset" @click={resetStructured()}>Reset structured</button>
                <button id="structured-resolve" @click={resolveStructured()}>Resolve structured</button>
                <button id="structured-reject" @click={rejectStructured()}>Reject structured</button>
            </div>
            <div id="structured-block">
                <div id="structured-await" #await={structuredPromise}>Structured waiting</div>
                <div #then={{ id: resolvedId, name: resolvedName }}>
                    Structured resolved
                    <span id="structured-then-id">{resolvedId}</span>
                    <strong id="structured-then-name">{resolvedName}</strong>
                </div>
                <div #catch={{ msg, code }}>
                    <span id="structured-catch-msg">{msg}</span>
                    Structured rejected
                    <strong id="structured-catch-code">{code}</strong>
                </div>
            </div>

            <div>
                <button id="priority-reset" @click={resetPriority()}>Reset priority</button>
                <button id="priority-resolve" @click={resolvePriority()}>Resolve priority</button>
                <button id="priority-toggle-if" @click={togglePriorityIf()}>Toggle priority if</button>
            </div>
            <div id="priority-block">
                <p
                    id="priority-await"
                    #await={priorityPromise}
                    #if={showPriorityPending}
                >
                    Priority pending
                </p>
                <p id="priority-then" #then={res}>Priority then: {res}</p>
                <p id="priority-catch" #catch={err}>Priority catch: {err}</p>
            </div>
        </section>
    `)
}

export default awaitDirectiveScenario
