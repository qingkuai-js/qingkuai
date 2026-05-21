import ts from "typescript"

import { any } from "../../util/shared/sundry"

export function hasParseError(sourceFile: ts.SourceFile) {
    return any(sourceFile).parseDiagnostics?.length > 0
}
