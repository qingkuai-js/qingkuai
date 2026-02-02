import type { ParseEventFlagFunc } from "#type-declarations/compiler-ex"
import type { ASTLocation, TemplateEventFlagInfo } from "#type-declarations/compiler"

import {
    ConflictingEventFlags,
    ExpectedEventFlagName,
    UnrecognizedEventFlag
} from "../message/error"
import { inputDescriptor } from "../state"
import { keyboardEventNamesRE } from "../regular"
import { newCleanObj } from "../../util/shared/sundry"
import { getLocByIndex } from "../../util/compiler/position"
import { CONFLICTING_EVENT_FLAG_MAP, EVENT_FLAGS_MAP } from "../constants"
import { DuplicateEventFlag, KeyFlagIgnoredOnNonKeyboardEvent } from "../message/warn"

export const parseEventFlag: ParseEventFlagFunc = (source, startSourceIndex = 0) => {
    const info: TemplateEventFlagInfo = {
        general: {
            value: 0,
            names: []
        },
        modifier: {
            value: 0,
            names: []
        }
    }
    const flagStartIndex = source.indexOf("|")
    const existingFlags: Record<string, ASTLocation> = newCleanObj()
    const eventName = -1 === flagStartIndex ? source : source.slice(0, flagStartIndex)
    const sourceFlagsArr = -1 === flagStartIndex ? [] : source.slice(flagStartIndex + 1).split("|")

    const updateFlag = (flagName: string, flagNameLoc: ASTLocation, modifier = false) => {
        const target = info[modifier ? "modifier" : "general"]
        if (!existingFlags[flagName]) {
            target.names.push(flagName)
        } else {
            DuplicateEventFlag(flagNameLoc, flagName)
        }

        // 检查是否存在冲突的事件标志
        // Check for conflicting event modifiers.
        const conflictingFlag = CONFLICTING_EVENT_FLAG_MAP[flagName]?.find(item => {
            return !!existingFlags[item]
        })
        if (conflictingFlag) {
            ConflictingEventFlags(flagNameLoc, flagName, conflictingFlag)
            ConflictingEventFlags(existingFlags[conflictingFlag], flagName, conflictingFlag)
        }

        existingFlags[flagName] = flagNameLoc
        target.value |= EVENT_FLAGS_MAP[flagName] ?? 0
    }

    for (
        let i = 0,
            flagName = "",
            flagNameStartSourceIndex = eventName.length + startSourceIndex + 1;
        i < sourceFlagsArr.length;
        i++
    ) {
        const flagNameLoc = getLocByIndex(
            flagNameStartSourceIndex,
            flagNameStartSourceIndex + (flagName = sourceFlagsArr[i]).length
        )
        switch (flagName) {
            case "once":
            case "stop":
            case "self":
            case "passive":
            case "prevent":
            case "capture": {
                updateFlag(flagName, flagNameLoc)
                break
            }

            case "meta":
            case "alt":
            case "ctrl":
            case "shift":
            case "exact": {
                updateFlag(flagName, flagNameLoc, true)
                break
            }

            case "tab":
            case "enter":
            case "delete":
            case "escape":
            case "space":
            case "up":
            case "down":
            case "left":
            case "right": {
                if (keyboardEventNamesRE.test(eventName)) {
                    updateFlag(flagName, flagNameLoc)
                } else {
                    KeyFlagIgnoredOnNonKeyboardEvent(flagNameLoc, flagName, eventName)
                }
                break
            }

            default: {
                if (flagName.trim()) {
                    UnrecognizedEventFlag(flagNameLoc, flagName)
                } else {
                    ExpectedEventFlagName(getLocByIndex(flagNameStartSourceIndex))
                }
            }
        }
        flagNameStartSourceIndex = flagNameLoc.end.index + 1
    }

    return { eventName, flagInfo: info }
}

export const parseEventFlagStandalone: ParseEventFlagFunc = (...args) => {
    const { checkMode } = inputDescriptor.options
    const ret = parseEventFlag(...args)
    return ((inputDescriptor.options.checkMode = checkMode), ret)
}
