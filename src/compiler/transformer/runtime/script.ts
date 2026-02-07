import type { CodeWriter } from "./writer"

import { analyzeResult } from "../../state"
import { traverseObject } from "../../../util/shared/sundry"

export function transformScript(writer: CodeWriter) {
    traverseObject(analyzeResult.script.topLevelIdentifiers, (key, value) => {
    })
}
