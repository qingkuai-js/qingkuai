import { formatSourceCode } from "../../../src/util/shared/sundry"

import type { E2EScenario } from "#type-declarations/testing"

const collectionScenario: E2EScenario = {
    name: "collection",
    title: "Collection operations",
    readySelector: "[data-page='collection']",
    input: formatSourceCode(`
        <lang-js>
            let nextId = 2
            let selectedId = 0
            const items = [
                { id: 1, label: "Alpha" },
                { id: 2, label: "Beta" }
            ]

            const addItem = () => {
                nextId++
                items.push({
                    id: nextId,
                    label: "Item " + nextId
                })
            }

            const removeFirst = () => {
                if (items.length) {
                    items.splice(0, 1)
                }
            }

            const selectItem = item => {
                selectedId = item.id
            }
        </lang-js>

        <section data-page="collection">
            <h1 id="collection-title">Collection</h1>
            <div>
                <button id="add-item" @click={addItem()}>Add item</button>
                <button id="remove-first" @click={removeFirst()}>Remove first</button>
            </div>
            <p id="collection-summary">{items.length} items</p>
            <ul id="collection-list">
                <li
                    #for={item of items}
                    #key={item.id}
                    class="collection-item"
                    !data-id={item.id}
                    !data-selected={selectedId === item.id ? "yes" : "no"}
                >
                    <button class="item-trigger" @click={selectItem(item)}>{item.label}</button>
                </li>
            </ul>
        </section>
    `)
}

export default collectionScenario
