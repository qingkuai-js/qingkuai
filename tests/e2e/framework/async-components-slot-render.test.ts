import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import Container from "./components/Container"
            import HeaderComponent from "./components/AsyncHeader"
            import FooterComponent from "./components/AsyncFooter"

            const createDeferred = () => {
                const handlers = {
                    resolve: () => {},
                    reject: () => {}
                }
                const promise = new Promise((resolve, reject) => {
                    handlers.resolve = resolve
                    handlers.reject = reject
                })
                return { handlers, promise }
            }

            const headerDeferred = createDeferred()
            const footerDeferred = createDeferred()

            let headerPromise = headerDeferred.promise
            let footerPromise = footerDeferred.promise

            const loadHeader = () => {
                headerDeferred.handlers.resolve(HeaderComponent)
            }

            const loadFooter = () => {
                footerDeferred.handlers.resolve(FooterComponent)
            }
        </lang-js>

        <section data-page="async-components-slot-render">
            <div>
                <button id="load-header" @click={loadHeader}>Load Header</button>
                <button id="load-footer" @click={loadFooter}>Load Footer</button>
            </div>

            <Container>
                <qk:spread #slot={"header"}>
                    <div id="header-loading" #await={headerPromise}>
                        <p>Loading header component...</p>
                    </div>
                    <qk:spread #then={HeaderMod}>
                        <HeaderMod />
                    </qk:spread>
                </qk:spread>

                <qk:spread #slot={"footer"}>
                    <div id="footer-loading" #await={footerPromise}>
                        <p>Loading footer component...</p>
                    </div>
                    <qk:spread #then={FooterMod}>
                        <FooterMod />
                    </qk:spread>
                </qk:spread>
            </Container>
        </section>
    `,
    components: {
        Container: `
            <div id="container" class="layout">
                <header id="header-slot">
                    <slot name="header">Default Header</slot>
                </header>
                <main id="main-content">
                    <p>Main Content</p>
                </main>
                <footer id="footer-slot">
                    <slot name="footer">Default Footer</slot>
                </footer>
            </div>
        `,
        AsyncHeader: `
            <div id="header-content" class="header">
                <h1>Async Header Component</h1>
            </div>
        `,
        AsyncFooter: `
            <div id="footer-content" class="footer">
                <p>© 2024 Async Footer Component</p>
            </div>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports async component rendering through named slots", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#header-loading")).toContainText("Loading header component...")
        await expect(page.locator("#footer-loading")).toContainText("Loading footer component...")
        await expect(page.locator("#header-content")).toHaveCount(0)
        await expect(page.locator("#footer-content")).toHaveCount(0)

        await page.locator("#load-header").click()
        await expect(page.locator("#header-content")).toBeVisible()
        await expect(page.locator("#header-loading")).toHaveCount(0)

        await page.locator("#load-footer").click()
        await expect(page.locator("#footer-content")).toBeVisible()
        await expect(page.locator("#footer-loading")).toHaveCount(0)
    })
})
