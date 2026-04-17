import type { E2EScenario } from "#type-declarations/testing"

import { formatSourceCode } from "../../src/util/shared/sundry"

export function renderIndexPage(scenarios: E2EScenario[]) {
    const links = scenarios.reduce((ret, item) => {
        return `${ret}<li><a href="/scenarios/${item.name}">${item.name}</a></li>`
    }, "")
    return formatSourceCode(`
        <!doctype html>
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>QingKuai E2E Scenarios</title>
            </head>
            <body>
                <main>
                    <h1>QingKuai Playwright scenarios</h1>
                    <ul>${links}</ul>
                </main>
            </body>
        </html>
    `)
}

export function renderScenarioPage(scenario: E2EScenario) {
    return formatSourceCode(`
        <!doctype html>
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>${scenario.name}</title>
                <script type="importmap">
                    {
                        "imports": {
                            "qingkuai": "/dist/esm/runtime/index.js",
                            "qingkuai/internal": "/dist/esm/runtime/internal.js"
                        }
                    }
                </script>
            </head>
            <body data-e2e-ready="loading">
                <main>
                    <div id="app"></div>
                </main>

                <script>
                    globalThis.__qk_max_schedule_depth = 300
                </script>

                <script type="module">
                    import { mountApp } from "qingkuai"
                    import App from "/scenarios/${scenario.name}/app.js"

                    mountApp(App, "#app")
                    document.body.dataset.e2eReady = "ready"
                </script>
            </body>
        </html>
    `)
}
