import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let stateClass = "state-on"
            let size = 10
            let dots = [{ id: 1, cls: "dot-on" }, { id: 2, cls: "dot-off" }]

            const changeIcon = () => {
                stateClass = "state-off"
                size = 24
            }

            const flipDots = () => {
                dots = [{ id: 1, cls: "dot-off" }, { id: 2, cls: "dot-on" }]
            }

            let selected
            function select(item) {
                selected = item
                return () => selected
            }
        </lang-js>

        <section data-page="attribute-svg-dynamic">
            <svg
                id="svg-root"
                class="icon"
                !class={stateClass}
                viewBox="0 0 10 10"
                !width={size}
                !height={size}
            >
                <circle id="svg-dot" !cx={size} !cy={size} !r={size}></circle>
                <circle
                    #for={dot of dots}
                    #key={dot.id}
                    class="dot"
                    !class={dot.cls}
                    !r={dot.id}
                ></circle>
            </svg>

            <svg id="svg-selection" viewBox="0 0 10 10">
                <rect
                    #for={item of 3}
                    #key={item}
                    class="pick"
                    !class={selected === item ? "pick-on" : ""}
                    width="2"
                    height="2"
                ></rect>
            </svg>

            <button id="btn-change" @click={changeIcon}>Change</button>
            <button id="btn-flip" @click={flipDots}>Flip</button>
            <button id="btn-pick" @click={select(2)}>Pick</button>

            <p id="state-class">{stateClass}</p>
            <p id="state-size">{size}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("dynamic attributes on svg mount without throwing", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        const attributes = await page.locator("#svg-root").evaluate(node => {
            return [
                node.getAttribute("class"),
                node.getAttribute("width"),
                node.getAttribute("height")
            ]
        })
        expect(attributes).toEqual(["icon state-on", "10", "10"])

        const circleAttributes = await page.locator("#svg-dot").evaluate(node => {
            return [node.getAttribute("cx"), node.getAttribute("cy"), node.getAttribute("r")]
        })
        expect(circleAttributes).toEqual(["10", "10", "10"])
    })

    test("dynamic attributes on svg update on state change", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#btn-change").click()
        await expect(page.locator("#state-class")).toHaveText("state-off")
        await expect(page.locator("#state-size")).toHaveText("24")

        const attributes = await page.locator("#svg-root").evaluate(node => {
            return [
                node.getAttribute("class"),
                node.getAttribute("width"),
                node.getAttribute("height")
            ]
        })
        expect(attributes).toEqual(["icon state-off", "24", "24"])

        const circleRadius = await page.locator("#svg-dot").evaluate(node => node.getAttribute("r"))
        expect(circleRadius).toBe("24")
    })

    test("keyed list rows inside svg write class as an attribute", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const classes = await page.locator("circle.dot").evaluateAll(nodes => {
            return nodes.map(node => [node.getAttribute("class"), node.namespaceURI])
        })
        expect(classes).toEqual([
            ["dot dot-on", "http://www.w3.org/2000/svg"],
            ["dot dot-off", "http://www.w3.org/2000/svg"]
        ])

        await page.locator("#btn-flip").click()
        await expect(page.locator("circle.dot").first()).toHaveClass("dot dot-off")
        await expect(page.locator("circle.dot").last()).toHaveClass("dot dot-on")
    })

    test("selector-optimized class on svg keyed rows writes an attribute", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await expect(page.locator("rect.pick")).toHaveCount(3)

        await page.locator("#btn-pick").click()

        const classes = await page.locator("rect.pick").evaluateAll(nodes => {
            return nodes.map(node => node.getAttribute("class"))
        })
        expect(classes).toEqual(["pick ", "pick pick-on", "pick "])

        const namespaces = await page.locator("rect.pick").evaluateAll(nodes => {
            return nodes.map(node => node.namespaceURI)
        })
        expect(namespaces).toEqual([
            "http://www.w3.org/2000/svg",
            "http://www.w3.org/2000/svg",
            "http://www.w3.org/2000/svg"
        ])
    })

    test("dynamic attributes on svg stay writable to the DOM", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        const namespace = await page.locator("#svg-root").evaluate(node => node.namespaceURI)
        expect(namespace).toBe("http://www.w3.org/2000/svg")

        const box = await page.locator("#svg-dot").evaluate(node => {
            const rect = (node as SVGGraphicsElement).getBBox()
            return [rect.width, rect.height]
        })
        expect(box).toEqual([20, 20])
    })
})
