import type { E2EScenario } from "#type-declarations/testing"

import counterScenario from "./inputs/counter"
import todoMvcScenario from "./inputs/todo-mvc"
import collectionScenario from "./inputs/collection"
import htmlDirectiveScenario from "./inputs/html-directive"
import ifDirectiveScenario from "./inputs/if-directive"
import forDirectiveScenario from "./inputs/for-directive"
import awaitDirectiveScenario from "./inputs/await-directive"
import targetDirectiveScenario from "./inputs/target-directive"
import nestedComponentsScenario from "./inputs/nested-components"

export const e2eScenarios = [
    counterScenario,
    todoMvcScenario,
    collectionScenario,
    htmlDirectiveScenario,
    ifDirectiveScenario,
    forDirectiveScenario,
    awaitDirectiveScenario,
    targetDirectiveScenario,
    nestedComponentsScenario
] satisfies E2EScenario[]

export type E2EScenarioName = (typeof e2eScenarios)[number]["name"]

export function getE2EScenario(name: string) {
    const scenario = e2eScenarios.find(item => item.name === name)
    if (!scenario) {
        throw new Error(`Unknown E2E scenario: ${name}`)
    }
    return scenario
}

export function isE2EScenarioName(value: string): value is E2EScenarioName {
    return e2eScenarios.some(item => item.name === value)
}
