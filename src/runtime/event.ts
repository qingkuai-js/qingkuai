import type { Setter, EventStructure, RefEventHandlerGetterGen, QingKuaiNodeStruct } from "./types"

import { attribute } from "./dom"
import { raw } from "./reactivity/value"
import { resolvedPromise } from "./promise"
import { vewf } from "../util/runtime/sundry"
import { IsWithReferenceRet } from "./constants"
import { ContainerTypeIsBad } from "./message/error"
import { EventWrapperFlagKeys } from "../util/types"
import { isArray, isNull } from "../util/shared/assert"
import { EventListenerFlag } from "../util/shared/flag"
import { notEqual, optc, setArrLength } from "../util/shared/sundry"

const Arrow = "Arrow"
const keyTypes = ["keydown", "keyup", "keypress"]

// 事件处理器包装器，用以支持按键修饰符与按键别名
// Wrapper of Event Handler, to support key modifiers and key aliases.
export function eventWrapper(
    fn: EventListener,
    flag: number = 0,
    other: string = ""
): EventListener {
    return function (this: any, event) {
        let code = ""
        let shouldInvokeHandler = true
        const keyRelated = keyTypes.includes(event.type)

        const verify = (fk: EventWrapperFlagKeys, ...pks: string[]) => {
            if (!shouldInvokeHandler) {
                return
            }
            if (vewf(flag, fk)) {
                // @ts-ignore
                shouldInvokeHandler = pks.includes(code) || event[fk + "Key"]
            }
        }

        if (keyRelated) {
            code = (event as KeyboardEvent).code
            verify("tab", "Tab")
            verify("esc", "Escape")
            verify("space", "Space")
            verify("up", Arrow + "Up")
            verify("down", Arrow + "Down")
            verify("left", Arrow + "Left")
            verify("right", Arrow + "Right")
            verify("del", "Delete", "Backspace")
            verify("enter", "Enter", "NumpadEnter")
            if (shouldInvokeHandler && other) {
                shouldInvokeHandler = code === other
            }
        }

        verify("alt", ...withLR("Alt"))
        verify("meta", ...withLR("Meta"))
        verify("shift", ...withLR("Shift"))
        verify("ctrl", ...withLR("Control"))

        shouldInvokeHandler && fn.call(this, event)
    }
}

// 生成原生标签引用属性使用的事件结构
export function withReference(
    eventName: string,
    attrName: string,
    value: any,
    setter: Setter | null,
    isInitCall = true
): EventStructure {
    const handlerGen: RefEventHandlerGetterGen = (qkNode, invokeGetter, attachUpdate) => {
        const target = qkNode.n as HTMLElement
        const targetAny = target as any
        const isInput = target.tagName === "INPUT"
        const isSelect = target.tagName === "SELECT"
        const attrKey = attrName as keyof typeof target

        // 初始化属性值，并将修改属性值的方法添加到所依赖的响应性值的effect中
        const setAttribute = () => {
            const gotValue = raw(invokeGetter(value))

            // 提前声明非数组或集合的检测包含方法，如果isValueIncluded被设置为
            // 这个方法则代表gotValue非Array也非Set（cct方法中如此操作）
            const equalToGotValue = (rv: any) => {
                return !notEqual(rv, gotValue)
            }

            // 如果容器类型不是数组或集合则抛出错误
            // cct means Check Container Type
            const cct = () => {
                if (isValueIncluded === equalToGotValue) {
                    ContainerTypeIsBad(
                        isInput ? "group" : "value",
                        isInput ? "input" : "select multiple"
                    )
                }
                return true
            }

            // 判断选项值是否被包含的方法，这里针对容器为数组或集合的不同情况提前
            // 声明了不同的判断方法，避免在检查多个option元素时的重复类型判断
            const isValueIncluded: (rv: any) => void = isArray(gotValue)
                ? rv => gotValue.includes(rv)
                : optc(gotValue) === "Set"
                ? rv => gotValue.has(rv)
                : equalToGotValue

            if (isInput && attrName === "group") {
                // gotValue中是否含有qkNode的value属性值即表示当前input元素是否被选中
                const checked = cct() && isValueIncluded(qkNode.attrs.value)
                return attribute(qkNode, "checked", checked, true)
            } else if (isSelect) {
                let hasUpdated = false

                // 多选时要检查容器类型（必须为Array或Set）
                targetAny.multiple && cct()

                // 在初始化select的选中项时，由于option元素还未被创建，所以不能正确地初始化，
                // 这里通过isInitCall判断是否初始化调用，是初始化调用的话就在异步微任务中重新
                // 调用一次setAttribute方法（此时HTML节点已挂载完毕）
                if (isInitCall) {
                    isInitCall = false
                    resolvedPromise.then(setAttribute)
                }

                // 如果非初始化调用，则判断gotValue中是否含有oqn的value属性值（option元素是否被选中）
                // 如果设置某个option元素的属性值（attribute调用）时返回true，则表示组件有更新
                for (const option of targetAny.options) {
                    const oqn = option["_qkNode"] as QingKuaiNodeStruct
                    const selected = isValueIncluded(oqn.attrs.value)
                    if (attribute(oqn, "selected", selected, true)) {
                        hasUpdated = true
                    }
                }
                return hasUpdated
            } else {
                // 如果是radio/checkbox控件的checked属性就正常处理属性变更
                return attribute(qkNode, attrKey, gotValue, true)
            }
        }

        // 初始化属性值并将更新属性值的方法添加到响应式值的effect中
        setAttribute(), attachUpdate(setAttribute)

        return () => {
            // select元素的value（非引用）属性，此时仅需绑定attribute部分的处理，在选项
            // 修改时不应该影响到相关的响应式值，所以应该直接接受eventHandler的执行
            if (isNull(setter)) {
                return
            }

            // 当setter不为null时，setter存在时表示当前的引用属性为：textarea[value]、
            // input[value/checked]、select[value]（单选），其他情况setter都为undefined
            if (setter) {
                if (!isSelect) {
                    setter(target[attrKey])
                } else {
                    setter(targetAny.selectedOptions[0]["_qkNode"].attrs.value)
                }
            } else {
                const gotValue = raw(invokeGetter(value))

                // 作用和setAttribute方法中的isValueIncluded声明类似，根据容器类型的不同提前声明
                // 添加容器值的方法，避免后续代码多次判断选择容器方法导致代码冗余和重复容器类型判断
                //
                // 这里同步响应式值的逻辑是先将容器清空，后将所有选中的值添加进去，而不是逐一对比某个
                // 选项是否选中再添加或删除选项值，因为对于数组操作来说，比对是否已经存在某个元素具有
                // O(n)的时间复杂度，而整个同步过程就会具有O(n^2)的时间复杂度，如果选项数量很多，每次
                // 修改选项都有较大的同步开销，而采用先清空后添加可以将同步过程的时间复杂度降低至O(n)
                let add!: (rv: any) => void
                if (isArray(gotValue)) {
                    add = rv => {
                        gotValue.push(rv)
                    }
                    setArrLength(gotValue, 0)
                } else if (optc(gotValue) === "Set") {
                    add = rv => {
                        gotValue.add(rv)
                    }
                    gotValue.clear()
                }

                // 下面的操作都是建立在gotValue类型只能为Array或Set的前提下进行的，此前提一定成立，原因如下：
                // 经编译器处理后，只有非radio/checkbox控件的group属性或多选select元素才会传入setter，
                // 并且在这里容器类型一定是数组或集合，不然在之前设置attribute的过程中会抛出错误
                if (isInput) {
                    if (targetAny.checked) {
                        add(qkNode.attrs.value)
                    }
                } else {
                    for (const option of targetAny.selectedOptions) {
                        add(option["_qkNode"].attrs.value)
                    }
                }
            }
        }
    }

    // 标记返回值为withReference方法的返回值，在h方法中处理事件监听时，会识别
    // withReference的返回值，并调用它的返回值（即handlerGen)以设置属性的初始值，
    // 并记录更新属性的方法到依赖的响应性值的effect中
    handlerGen[IsWithReferenceRet] = true

    // 返回eventStructure，这里设置了compose标志，这样做是为了在输入合成过程中让setter随着
    // 输入的进行被实时调用并更新响应性值（setter是一个仅包含赋值操作的单语句函数，执行开销非常小）
    return [eventName, handlerGen, EventListenerFlag.compose]
}

function withLR(code: string): [string, string] {
    return [code + "Left", code + "Right"]
}
