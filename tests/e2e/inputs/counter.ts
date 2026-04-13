import { formatSourceCode } from "../../../src/util/shared/sundry"

import type { E2EScenario } from "#type-declarations/testing"

const counterScenario: E2EScenario = {
    name: "counter",
    title: "Counter interactions",
    readySelector: "[data-page='counter']",
    input: formatSourceCode(`
        <lang-js>
            let count = 0

            const increase = () => {
                count++
            }

            const decrease = () => {
                count--
            }
        </lang-js>

        <section data-page="counter">
            <h1 id="counter-title">Counter</h1>
            <p id="counter-value">{count}</p>
            <div>
                <button id="decrement" @click={decrease()}>Decrease</button>
                <button id="increment" @click={increase()}>Increase</button>
            </div>
        </section>
    `)
}

export default counterScenario
