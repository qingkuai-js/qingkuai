import { stringify } from "../shared/aliases"
import { analyzeResult, generateIdentifier, inputDescriptor } from "../../compiler/state"

export const createHashId = (function () {
    const existing = new Set<string>()
    const max = parseInt(`0x${"f".repeat(8)}`)
    return () => {
        while (true) {
            const hash = Math.floor(Math.random() * max).toString(16)
            if (existing.has(hash)) {
                continue
            }
            return (existing.add(hash), hash)
        }
    }
})()

export function getEventName(rawName: string) {
    const sepratorIndex = rawName.indexOf("|")
    if (-1 === sepratorIndex) {
        return rawName
    }
    return rawName.slice(0, sepratorIndex)
}

export function getAttributeBaseName(name: string) {
    switch (name[0]) {
        case "!":
        case "@":
        case "#":
        case "&": {
            return name.slice(1)
        }
    }
    return name
}

export function ensureIdWithPrefix(name: string, prefix = "_") {
    const { fullIdentifiers } = analyzeResult.script
    const startIndex = (generateIdentifier.prefix[name] ??= 0)
    name = prefix.repeat(startIndex) + name

    while (fullIdentifiers.has(name)) {
        name = prefix + name
        generateIdentifier.prefix[name]++
    }
    return (fullIdentifiers.add(name), name)
}

export function ensureIdWithNumSuffix(name: string, useOrigin = false) {
    const { fullIdentifiers } = analyzeResult.script
    const generateInfo = (generateIdentifier.suffix[name] ??= {
        last: 1,
        originUsed: false
    })
    if (useOrigin && !generateInfo.originUsed && !fullIdentifiers.has(name)) {
        generateInfo.originUsed = true
    } else {
        for (let i = generateInfo.last, initial = name; true; i++) {
            if (!fullIdentifiers.has((name = initial + i))) {
                break
            }
        }
    }
    return (fullIdentifiers.add(name), name)
}

export function increaseReusedStringUsedTimes(value: string) {
    if (inputDescriptor.options.debug || inputDescriptor.options.checkMode) {
        return
    }
    ;(analyzeResult.reusedStrings[value] ??= { id: "", times: 0 }).times++
}

export function shouldExtractCommonString(value: string) {
    const count = analyzeResult.reusedStrings[value]?.times ?? 0
    return count <= 1 ? false : count === 2 ? value.length > 4 : true
}

export function getMaybeReusedString(value: string) {
    let ret: string | undefined
    if (!(ret = analyzeResult.reusedStrings[value]?.id)) {
        return stringify(value)
    }
    return `${inputDescriptor.options.tipComment ? `/* ${value} */ ` : ""}${ret}`
}

export function increaseCompressStringUsedTimes(str: string) {
    if (inputDescriptor.options.debug || inputDescriptor.options.checkMode) {
        return
    }
    if (str.length > Math.floor(analyzeResult.template.compressStringsCount / 10) + 1) {
        if (!analyzeResult.template.compressStrings[str]) {
            analyzeResult.template.compressStrings[str] = {
                times: 0,
                index: -1
            }
            increaseReusedStringUsedTimes(str)
            analyzeResult.template.compressStringsCount++
        }
        analyzeResult.template.compressStrings[str].times++
    }
}
