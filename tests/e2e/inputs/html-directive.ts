import { formatSourceCode } from "../../../src/util/shared/sundry"

import type { E2EScenario } from "#type-declarations/testing"

const htmlDirectiveScenario: E2EScenario = {
    name: "html-directive",
    title: "Html directive",
    readySelector: "[data-page='html-directive']",
    input: formatSourceCode(`
        <lang-js>
            let rawHtml = '<strong id="html-strong">Hello Html</strong>'
            let htmlOptions = {}
            let spreadHtml = '<b id="html-spread-inner">Spread html</b>'
            let showIfHtml = true
            let ifHtml = '<i id="html-if-inner">If html</i>'
            let forItems = [
                { id: 1, html: '<span class="html-for-inner">For A</span>' },
                { id: 2, html: '<span class="html-for-inner">For B</span>' }
            ]
            let htmlPromise = createPendingPromise()

            function createPendingPromise() {
                return new Promise(() => {})
            }

            const setInitialHtml = () => {
                rawHtml = '<strong id="html-strong">Hello Html</strong>'
            }

            const setUpdatedHtml = () => {
                rawHtml = '<em id="html-em">Updated Html</em>'
            }

            const setScriptHtml = () => {
                rawHtml = '<script id="html-script">window.__qk_html_test__ = 1</script><p id="html-p">Script tail</p>'
            }

            const setIframeHtml = () => {
                rawHtml = '<iframe id="html-frame" src="about:blank"></iframe><span id="html-span">Frame tail</span>'
            }

            const useNoEscape = () => {
                htmlOptions = {}
            }

            const useEscapeScript = () => {
                htmlOptions = { escapeScript: true }
            }

            const useEscapeIframe = () => {
                htmlOptions = { escapeTags: ["iframe"] }
            }

            const setSpreadInitial = () => {
                spreadHtml = '<b id="html-spread-inner">Spread html</b>'
            }

            const setSpreadUpdated = () => {
                spreadHtml = '<u id="html-spread-updated">Spread updated</u>'
            }

            const toggleIfHtml = () => {
                showIfHtml = !showIfHtml
            }

            const setIfInitial = () => {
                ifHtml = '<i id="html-if-inner">If html</i>'
            }

            const setIfUpdated = () => {
                ifHtml = '<i id="html-if-inner">If html updated</i>'
            }

            const appendForItem = () => {
                forItems.push({
                    id: forItems.length + 1,
                    html: '<span class="html-for-inner">For ' + String.fromCharCode(64 + forItems.length + 1) + '</span>'
                })
            }

            const removeForItem = () => {
                if (forItems.length) {
                    forItems.pop()
                }
            }

            const updateForSecond = () => {
                if (forItems[1]) {
                    forItems[1].html = '<span class="html-for-inner">For B Updated</span>'
                }
            }

            const resetAwait = () => {
                htmlPromise = createPendingPromise()
            }

            const resolveAwait = () => {
                htmlPromise = new Promise(resolve => {
                    setTimeout(() => resolve('<strong id="html-await-then-inner">Then html</strong>'), 10)
                })
            }

            const rejectAwait = () => {
                htmlPromise = new Promise((_, reject) => {
                    setTimeout(() => reject('<strong id="html-await-catch-inner">Catch html</strong>'), 10)
                })
            }
        </lang-js>

        <section data-page="html-directive">
            <h1 id="html-title">Html directive</h1>

            <div>
                <button id="html-set-initial" @click={setInitialHtml()}>Set initial html</button>
                <button id="html-set-updated" @click={setUpdatedHtml()}>Set updated html</button>
                <button id="html-set-script" @click={setScriptHtml()}>Set script html</button>
                <button id="html-set-iframe" @click={setIframeHtml()}>Set iframe html</button>
            </div>

            <div>
                <button id="html-escape-none" @click={useNoEscape()}>No escape</button>
                <button id="html-escape-script" @click={useEscapeScript()}>Escape script</button>
                <button id="html-escape-iframe" @click={useEscapeIframe()}>Escape iframe</button>
            </div>

            <div id="html-host" #html={htmlOptions}>{rawHtml}</div>

            <div>
                <button id="html-spread-initial" @click={setSpreadInitial()}>Spread initial</button>
                <button id="html-spread-updated" @click={setSpreadUpdated()}>Spread updated</button>
            </div>
            <div id="html-spread-host">
                <qk:spread #html>{spreadHtml}</qk:spread>
            </div>

            <div>
                <button id="html-if-toggle" @click={toggleIfHtml()}>Toggle html if</button>
                <button id="html-if-initial" @click={setIfInitial()}>If initial</button>
                <button id="html-if-updated" @click={setIfUpdated()}>If updated</button>
            </div>
            <div id="html-if-host">
                <div id="html-if-block" #if={showIfHtml} #html>{ifHtml}</div>
            </div>

            <div>
                <button id="html-for-append" @click={appendForItem()}>For append</button>
                <button id="html-for-remove" @click={removeForItem()}>For remove</button>
                <button id="html-for-update-second" @click={updateForSecond()}>For update second</button>
            </div>
            <ul id="html-for-host">
                <li #for={item of forItems} #key={item.id} #html>{item.html}</li>
            </ul>

            <div>
                <button id="html-await-reset" @click={resetAwait()}>Await reset</button>
                <button id="html-await-resolve" @click={resolveAwait()}>Await resolve</button>
                <button id="html-await-reject" @click={rejectAwait()}>Await reject</button>
            </div>
            <div id="html-await-host">
                <div id="html-await-pending" #await={htmlPromise} #html>
                    {'<span id="html-await-pending-inner">Pending html</span>'}
                </div>
                <div id="html-await-then" #then={value} #html>{value}</div>
                <div id="html-await-catch" #catch={err} #html>{err}</div>
            </div>
        </section>
    `)
}

export default htmlDirectiveScenario
