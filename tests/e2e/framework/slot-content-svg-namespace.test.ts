import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import Icon from "./components/slot-svg/Icon"
            import HtmlBox from "./components/slot-svg/HtmlBox"

            let stateClass = "state-on"
            let radius = 10

            const changeIcon = () => {
                stateClass = "state-off"
                radius = 24
            }
        </lang-js>

        <section data-page="slot-content-svg-namespace">
            <Icon><circle id="icon-dot" !class={stateClass} !r={radius}></circle></Icon>
            <HtmlBox><circle id="slot-html" r="4"></circle></HtmlBox>

            <button id="btn-change" @click={changeIcon}>Change</button>

            <p id="state-class">{stateClass}</p>
            <p id="state-radius">{radius}</p>
        </section>
    `,
    components: {
        "slot-svg/Icon": `
            <svg id="icon-root" viewBox="0 0 40 40">
                <slot></slot>
            </svg>
        `,
        "slot-svg/HtmlBox": `
            <svg id="html-box-root" viewBox="0 0 40 40">
                <foreignObject x="0" y="0" width="40" height="40">
                    <slot></slot>
                </foreignObject>
            </svg>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("content passed to a slot inside svg is created in the svg namespace", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const namespace = await page.locator("#icon-dot").evaluate(node => node.namespaceURI)
        expect(namespace).toBe("http://www.w3.org/2000/svg")

        const box = await page.locator("#icon-dot").evaluate(node => {
            const rect = (node as SVGGraphicsElement).getBBox()
            return [rect.width, rect.height]
        })
        expect(box).toEqual([20, 20])
    })

    test("attributes of slot content keep updating after mount", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#icon-dot")).toHaveAttribute("class", "state-on")
        await expect(page.locator("#icon-dot")).toHaveAttribute("r", "10")

        await page.locator("#btn-change").click()
        await expect(page.locator("#state-class")).toHaveText("state-off")

        await expect(page.locator("#icon-dot")).toHaveAttribute("class", "state-off")
        await expect(page.locator("#icon-dot")).toHaveAttribute("r", "24")

        const box = await page.locator("#icon-dot").evaluate(node => {
            const rect = (node as SVGGraphicsElement).getBBox()
            return rect.width
        })
        expect(box).toBe(48)
    })

    test("content passed to a slot inside foreignObject stays in the html namespace", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const details = await page.locator("#slot-html").evaluate(node => {
            return {
                namespace: node.namespaceURI,
                parentTag: node.parentElement?.tagName
            }
        })
        expect(details.namespace).toBe("http://www.w3.org/1999/xhtml")
        expect(details.parentTag).toBe("foreignObject")
    })
})
