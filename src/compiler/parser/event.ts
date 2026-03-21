import type {
    ASTLocation,
    CompileMessage,
    EventFlagInfo,
    TemplateAttribute
} from "#type-declarations/compiler"
import type { ParseEventFlagFunc } from "#type-declarations/compiler-ex"

import {
    ConflictingEventFlags,
    ExpectedEventFlagName,
    UnrecognizedEventFlag
} from "../message/error"
import { keyboardEventNamesRE } from "../regular"
import { inputDescriptor, messages } from "../state"
import { newCleanObj } from "../../util/shared/sundry"
import { CONFLICTING_EVENT_FLAG_MAP, EVENT_FLAGS_MAP } from "../constants"
import { getLocByIndex, getRangeByLocation } from "../../util/compiler/position"
import { DuplicateEventFlag, KeyFlagIgnoredOnNonKeyboardEvent } from "../message/warn"

export const parseEventFlag: ParseEventFlagFunc = (event: TemplateAttribute) => {
    const generalFlag: EventFlagInfo = {
        value: 0,
        items: []
    }
    const wrapperFlag: EventFlagInfo = {
        value: 0,
        items: []
    }

    const source = event.name.raw
    const flagStartIndex = source.indexOf("|")
    const startSourceIndex = event.name.loc.start.index
    const existingFlags: Record<string, ASTLocation> = newCleanObj()
    const eventName = -1 === flagStartIndex ? source : source.slice(0, flagStartIndex)
    const sourceFlagsArr = -1 === flagStartIndex ? [] : source.slice(flagStartIndex + 1).split("|")

    const updateFlag = (flagName: string, flagNameLoc: ASTLocation, wrapper = false) => {
        const target = wrapper ? wrapperFlag : generalFlag
        if (!existingFlags[flagName]) {
            target.items.push({
                name: flagName,
                sourceRange: getRangeByLocation(flagNameLoc)
            })
        } else {
            DuplicateEventFlag(flagNameLoc, flagName)
        }

        // 检查是否存在冲突的事件标志
        // Check for conflicting event flags.
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
        let i = 0, flagName, flagNameStartSourceIndex = eventName.length + startSourceIndex + 1;
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
                    updateFlag(flagName, flagNameLoc, true)
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

    return { eventName, generalFlag, wrapperFlag }
}

export const parseEventFlagStandalone: ParseEventFlagFunc = (event: TemplateAttribute) => {
    const isCheckMode = inputDescriptor.options.checkMode
    const originMessageLen = messages.length
    inputDescriptor.options.checkMode = true

    const ret = parseEventFlag(event)
    inputDescriptor.options.checkMode = isCheckMode

    let parseMessages: CompileMessage[] | undefined = undefined
    if (originMessageLen !== messages.length) {
        parseMessages = messages.slice(originMessageLen)
    }
    return {
        ...ret,
        messages: parseMessages
    }
}
