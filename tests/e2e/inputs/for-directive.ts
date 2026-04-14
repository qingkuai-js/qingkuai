import { formatSourceCode } from "../../../src/util/shared/sundry"

import type { E2EScenario } from "#type-declarations/testing"

const forDirectiveScenario: E2EScenario = {
    name: "for-directive",
    title: "For directive",
    readySelector: "[data-page='for-directive']",
    input: formatSourceCode(`
        <lang-js>
            import RowPanel from "./components/RowPanel"

            let nextId = 2
            let repeatItems = [1, 2, 3]
            let showEvenOnly = false
            let items = [
                { id: 1, label: "Alpha" },
                { id: 2, label: "Beta" }
            ]
            let spreadItems = [
                { label: "Spread A", action: "Action A" },
                { label: "Spread B", action: "Action B" }
            ]
            const groups = [
                { name: "Group A", entries: ["A1", "A2"] },
                { name: "Group B", entries: ["B1"] }
            ]

            const addItem = () => {
                nextId++
                items.push({ id: nextId, label: "Item " + nextId })
            }

            const removeLastItem = () => {
                if (items.length) {
                    items.pop()
                }
            }

            const swapFirstTwoItems = () => {
                if (items.length > 1) {
                    items = [items[1], items[0], ...items.slice(2)]
                }
            }

            const setRepeatZero = () => {
                repeatItems = []
            }

            const setRepeatFour = () => {
                repeatItems = [1, 2, 3, 4]
            }

            const toggleEvenOnly = () => {
                showEvenOnly = !showEvenOnly
            }

            const toggleSpreadItems = () => {
                spreadItems = spreadItems.length === 2
                    ? [{ label: "Spread C", action: "Action C" }]
                    : [
                          { label: "Spread A", action: "Action A" },
                          { label: "Spread B", action: "Action B" }
                      ]
            }

            const appendGroupEntry = () => {
                groups[0].entries.push("A" + (groups[0].entries.length + 1))
            }
        </lang-js>

        <section data-page="for-directive">
            <h1 id="for-title">For directive</h1>

            <div>
                <button id="for-add-item" @click={addItem()}>Add item</button>
                <button id="for-remove-item" @click={removeLastItem()}>Remove last</button>
                <button id="for-swap-items" @click={swapFirstTwoItems()}>Swap first two</button>
            </div>

            <ul id="for-basic-list">
                <li
                    #for={item, index of items}
                    #key={item.id}
                    class="for-basic-item"
                    !data-id={item.id}
                >
                    {index}:{item.label}
                </li>
            </ul>

            <div id="for-component-list">
                <RowPanel
                    #for={item, index of items}
                    #key={item.id}
                >
                    <span class="for-component-text">{index}:{item.label}</span>
                </RowPanel>
            </div>

            <div id="for-component-order-host">
                <span class="for-component-order-marker">Before</span>
                <RowPanel
                    #for={item, index of items}
                    #key={"order-" + item.id}
                >
                    <span class="for-component-order-text">{index}:{item.label}</span>
                </RowPanel>
                <span class="for-component-order-marker">After</span>
            </div>

            <ul id="for-destructure-list">
                <li
                    #for={{ id, label } of items}
                    class="for-destructure-item"
                >
                    {id}-{label}
                </li>
            </ul>

            <button id="for-toggle-even-only" @click={toggleEvenOnly()}>Toggle even only</button>
            <ul id="for-if-nested-list">
                <li #for={item of items} class="for-if-nested-item">
                    <span
                        #if={!showEvenOnly || item.id % 2 === 0}
                        class="for-if-hit"
                    >
                        show:{item.label}
                    </span>
                    <span #else class="for-if-miss">hide:{item.label}</span>
                </li>
            </ul>

            <div>
                <button id="for-repeat-zero" @click={setRepeatZero()}>Repeat 0</button>
                <button id="for-repeat-four" @click={setRepeatFour()}>Repeat 4</button>
            </div>
            <div id="for-repeat-host">
                <span #for={n of repeatItems} class="for-repeat-item">{n}</span>
            </div>

            <button id="for-toggle-spread" @click={toggleSpreadItems()}>Toggle spread items</button>
            <div id="for-spread-host">
                <qk:spread #for={item of spreadItems}>
                    <span class="for-spread-label">{item.label}</span>
                    <button class="for-spread-action">{item.action}</button>
                </qk:spread>
            </div>

            <button id="for-append-group-entry" @click={appendGroupEntry()}>Append group entry</button>
            <ul id="for-nested-groups">
                <li #for={group of groups} class="for-group-item">
                    <h3 class="for-group-title">{group.name}</h3>
                    <ul class="for-group-entries">
                        <li #for={entry of group.entries} class="for-group-entry">{entry}</li>
                    </ul>
                </li>
            </ul>
        </section>
    `),
    components: {
        RowPanel: formatSourceCode(`
            <article class="for-component-item">
                <slot></slot>
            </article>
        `)
    }
}

export default forDirectiveScenario
