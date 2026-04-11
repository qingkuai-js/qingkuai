import type { E2EScenario } from "#type-declarations/testing"

import counterScenario from "./inputs/counter"
import todoMvcScenario from "./inputs/todo-mvc"
import collectionScenario from "./inputs/collection"
import nestedComponentsScenario from "./inputs/nested-components"

export const e2eScenarios = [
    counterScenario,
    collectionScenario,
    todoMvcScenario,
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