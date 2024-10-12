import { typedKeys } from "../util/shared/sundry"

export const compilerOptions = {
    checkMode: false,
    debugeMode: true,
    generateSourcemap: true,
    reserveTemplateComment: false
}

export function setCompilerOptions(options: Partial<typeof compilerOptions>) {
    typedKeys(options).forEach(key => {
        compilerOptions[key] = options[key]!
    })

    // 开启调试模式就必须生成sourcemap
    if (compilerOptions.debugeMode) {
        compilerOptions.generateSourcemap = true
    }
}
