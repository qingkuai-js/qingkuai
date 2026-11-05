import type { Page } from "@playwright/test"
import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let rows = [{ id: 1 }, { id: 2 }, { id: 3 }]
            let selected = 1

            function pick(id) {
                selected = id
                return () => selected
            }

            function clearSelection() {
                selected = null
                return () => selected
            }
        </lang-js>

        <section data-page="selector-keyed-svg">
            <svg id="svg-shapes" viewBox="0 0 10 10">
                <defs>
                    <g id="shape-a"><circle cx="2" cy="2" r="1"></circle></g>
                    <g id="shape-b"><circle cx="6" cy="6" r="1"></circle></g>
                </defs>

                <rect
                    #for={row of rows}
                    #key={row.id}
                    class="cell"
                    !class={selected === row.id ? "on" : ""}
                    !rx={selected === row.id ? 3 : 0}
                    !data-id={row.id}
                    width="4"
                    height="4"
                ></rect>

                <use
                    #for={row of rows}
                    #key={row.id}
                    !xlink:href={selected === row.id ? "#shape-a" : "#shape-b"}
                    !data-id={row.id}
                ></use>
            </svg>

            <button id="pick-2" @click={pick(2)}>Pick 2</button>
            <button id="clear" @click={clearSelection()}>Clear</button>

            <p id="state-selected">{selected}</p>
        </section>
    `
}

const readShapes = (page: Page) => {
    return page.locator("#svg-shapes rect.cell").evaluateAll(nodes => {
        return nodes.map(node => ({
            id: node.getAttribute("data-id"),
            cls: (node.getAttribute("class") || "").trim(),
            rx: node.getAttribute("rx"),
            namespace: node.namespaceURI
        }))
    })
}

const readUses = (page: Page) => {
    return page.locator("#svg-shapes use").evaluateAll(nodes => {
        return nodes.map(node => node.getAttribute("xlink:href"))
    })
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("initial selection marks the matching svg row", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        expect(await readShapes(page)).toEqual([
            { id: "1", cls: "cell on", rx: "3", namespace: "http://www.w3.org/2000/svg" },
            { id: "2", cls: "cell", rx: "0", namespace: "http://www.w3.org/2000/svg" },
            { id: "3", cls: "cell", rx: "0", namespace: "http://www.w3.org/2000/svg" }
        ])
        expect(await readUses(page)).toEqual(["#shape-a", "#shape-b", "#shape-b"])
    })

    test("moving the selection moves class and attributes between svg rows", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#pick-2").click()
        await expect(page.locator("#state-selected")).toHaveText("2")

        expect(await readShapes(page)).toEqual([
            { id: "1", cls: "cell", rx: "0", namespace: "http://www.w3.org/2000/svg" },
            { id: "2", cls: "cell on", rx: "3", namespace: "http://www.w3.org/2000/svg" },
            { id: "3", cls: "cell", rx: "0", namespace: "http://www.w3.org/2000/svg" }
        ])
        expect(await readUses(page)).toEqual(["#shape-b", "#shape-a", "#shape-b"])
    })

    test("clearing the selection resets class and attributes", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#pick-2").click()
        await page.locator("#clear").click()

        expect(await readShapes(page)).toEqual([
            { id: "1", cls: "cell", rx: "0", namespace: "http://www.w3.org/2000/svg" },
            { id: "2", cls: "cell", rx: "0", namespace: "http://www.w3.org/2000/svg" },
            { id: "3", cls: "cell", rx: "0", namespace: "http://www.w3.org/2000/svg" }
        ])
        expect(await readUses(page)).toEqual(["#shape-b", "#shape-b", "#shape-b"])
    })
})
