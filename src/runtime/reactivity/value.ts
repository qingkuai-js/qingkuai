import type {
    Setter,
    PGetHandler,
    PSetHandler,
    ReactiveTarget,
    EffectListItem,
    PDeleteHandler,
    DestructuringFunc
} from "../types"

import {
    NIL,
    UNDEF,
    NOOP,
    REFLECT,
    WRAPPER,
    IS_PROXY,
    RAW_VALUE,
    EXPOSE_DEPENDECIES
} from "../constants"
import {
    isNull,
    isArray,
    isNumber,
    isThenable,
    isFunction,
    isUndefined
} from "../../util/shared/assert"
import { usedEffectList } from "./state"
import { runSyncEffect } from "./effect"
import { scheduleUpdate } from "../schedule"
import { getCurrentInstance } from "../instance"
import { BadReactivityLevel } from "../message/error"
import { isReactive } from "../../util/runtime/assert"
import { notEqual, optc } from "../../util/shared/sundry"

const react = reactGen()
const constReact = reactGen(1)
const destructuringReact = destructuringReactGen()
const constDestructuringReact = destructuringReactGen(true)

export class ReactivityWrapper {
    declare proxy: any
    declare effect: EffectListItem

    constructor(
        public raw: any,
        public level: number,
        public typeFlag: number,
        public debugSetter: Setter,
        initEffect?: EffectListItem
    ) {
        this.proxy = new Proxy(raw, this)
        this.effect = initEffect || [new Set(), NIL]
    }

    get: PGetHandler = (target, property, receiver) => {
        // 特殊属性读取
        if (property === IS_PROXY) {
            return true
        }
        if (property === WRAPPER) {
            return this
        }
        if (property === RAW_VALUE) {
            return this.raw
        }

        const { effect, typeFlag, level } = this
        const propValue = REFLECT.get(target, property, receiver)

        // 再次将某个子属性值包装为代理值，层级-1，共享副作用列表
        const reactAgain = (nextTarget: any) => {
            return react(nextTarget, level - 1, effect)
        }

        // 记录响应性值的副作用
        usedEffectList.add(effect)

        // 捕获Set、Map类型，它们的读写操作都在这里完成代理兼容
        if (typeFlag & 6) {
            if (!isFunction(propValue)) {
                return propValue
            }

            return (...args: any) => {
                const getResultOfMethodCall = () => {
                    return target[property](...args)
                }

                if (property === "forEach") {
                    const [oriCallback, thisArg] = args
                    return target[property]((ck: any, cv: any, cs: any) => {
                        oriCallback(reactAgain(ck), reactAgain(cv), cs)
                    }, thisArg)
                }

                if (property === "keys" || property === "values" || property === "entries") {
                    const iterator = getResultOfMethodCall()
                    const oriIteratorNext = iterator.next
                    iterator.next = () => {
                        const nextRet = oriIteratorNext.call(iterator)
                        if (!nextRet.done) {
                            nextRet.value = reactAgain(nextRet.value)
                        }
                        return nextRet
                    }
                    return iterator
                }

                const [key, value] = args
                const oriSize = target.size
                const isSet = !(typeFlag & 4)
                const result = getResultOfMethodCall()
                const isMapSet = !isSet && property === "set"
                const preValue = isMapSet ? target.get(key) : UNDEF
                const valueChanged = isMapSet && notEqual(preValue, value)
                if (
                    property === "clear" ||
                    property === "delete" ||
                    property === (isSet ? "add" : "set")
                ) {
                    if (target.size !== oriSize || valueChanged) {
                        processEffect(effect)
                    }
                }
                return result
            }
        }
        return reactAgain(propValue)
    }

    set: PSetHandler = (target, property, value, receiver) => {
        const { debugSetter, effect } = this
        if (notEqual(target[property], value)) {
            if (debugSetter !== NOOP) {
                debugSetter(value)
            }
            // prettier-ignore
            const ret = REFLECT.set(
                target,
                property,
                value,
                receiver
            )
            return processEffect(effect), ret
        }
        return true
    }

    deleteProperty: PDeleteHandler = (target, property) => {
        processEffect(this.effect)
        return REFLECT.deleteProperty(target, property)
    }
}

// 获取代理值的原始值
export function raw<T extends ReactiveTarget>(v: T): T {
    return (isReactive(v) ? v[RAW_VALUE] : v) as any
}

// 使用原始值更新：当需要频繁更新响应式值时，可在此方法回调中操作原始值，回调结束后
// 响应式值的副作用列表会被调用，避免频繁更新时频繁运算ReactivityWrapper中的逻辑
export function updateWithRaw<T extends ReactiveTarget>(
    value: T,
    cb: (raw: T) => Promise<any> | void
) {
    if (!isReactive(value)) {
        return cb(value)
    }

    const ret = cb(raw(value))
    const process = () => processEffect(value.effect)
    isThenable(ret) ? ret.then(process) : process()
}

export function createStore<T extends ReactiveTarget>(value: T): T {
    return constReact(value).$
}

// 生成reactivity和constReact的方法
// levelDown表示需要降低的层级，const声明时为1，var、let声明时为0，因为var和let声明
// 会被作为最外层对象的$属性值，所以通过主动降低const的层级可以使用户侧层级参数的作用表现一致
//
// 该方法返回声明响应性依赖的方法，参数1是需要Proxy包装的目标
// 第二和第三个参数分三种情况：1.非调试模式响应性声明、 2.调试模式响应性声明、3.递归调用
// 参数2在上述三种情况下分别表示：响应层级、为调试变量赋值的setter方法、响应层级
// 参数3在上述三种情况下分别表示：固定为undefined、响应层级、来自父响应性依赖的副作用（子代共享）
// 当参数2为undefined或number类型时可以确定处于情况1，参数2为function类型时可以确定处于情况2，否则处于情况3
//
// los means Level or debug Setter, eol means init Effect or Level
function reactGen(levelDown = 0) {
    return (target?: any, los?: number | Setter, eol?: EffectListItem | number) => {
        let level = Infinity
        let debugSetter: Setter = NOOP
        let effect: EffectListItem | undefined = UNDEF

        const isDebug = isFunction(los)
        const eolIsNumber = isNumber(eol)
        const eolIsUndefined = isUndefined(eol)
        const isDeclaration = isDebug || eolIsNumber || eolIsUndefined

        if (isDeclaration) {
            if (!isDebug) {
                if (!isUndefined(los)) {
                    level = los
                }
            } else {
                debugSetter = los
                if (!eolIsUndefined) {
                    level = eol as number
                }
            }
            if (level - levelDown < 0) {
                BadReactivityLevel(level)
            }
            level -= levelDown

            if (isReactive(target)) {
                target = target[RAW_VALUE]
            }

            // 声明响应式变量时需要将其作为对象的$属性
            target = {
                $: target
            }
        } else {
            level = los as number
            effect = eol as EffectListItem
        }

        const typeFlag = getTypeFlag(target)
        if (!typeFlag || level < 0) {
            return target
        }

        // prettier-ignore
        const ret = new ReactivityWrapper(
            target,
            level,
            typeFlag,
            debugSetter,
            effect
        )
        if (isDeclaration) {
            if (EXPOSE_DEPENDECIES) {
                const component = getCurrentInstance()
                component && component.__.deps.push(ret)
            }
        }

        // debug模式下的let声明会返回代理包装和原始值组成的数组
        return isDebug ? [ret.proxy, ret.proxy.$] : ret.proxy
    }
}

// 解构语法响应性声明，将解构出的每一个标识符都声明为响应性变量，生成方法
// 的第一个参数是一个数组，它的第一个元素是解构函数，其余的元素是每个解构
// 出来的标识符setter（调试模式下修改调试标识符时调用以修改原始标识符的值）
export function destructuringReactGen(isConst = false) {
    const reactFn = isConst ? constReact : react
    return (dfnAndSetters: [DestructuringFunc, ...Setter[]], value: any, level = Infinity) => {
        const [dfn, ...setters] = dfnAndSetters
        const isDebug = !isUndefined(dfnAndSetters[1])

        // 非调试模式
        if (!isDebug) {
            return dfn(value).map(v => {
                return reactFn(v, level)
            })
        }

        // 调试模式
        return dfn(value).map((v, i) => {
            return reactFn(v, setters[i], level)
        })
    }
}

// 运行同步副作用，调度更新
// run sync effects and scheduling update
function processEffect(effect: EffectListItem) {
    runSyncEffect(effect[1])
    scheduleUpdate(effect[0])
}

// 获取传入值的类型位掩码，这里采用二进制位的方法是为了在Proxy中可以快速判断多种类型的组合
function getTypeFlag(v: any) {
    if (typeof v !== "object" || isNull(v)) {
        return 0
    }

    if (isArray(v)) {
        return 1
    }

    const vt = optc(v)
    const referenceTypes = ["Object", "Set", "Map"]
    for (let i = 0; i < 3; i++) {
        if (vt === referenceTypes[i]) {
            return 1 << i
        }
    }

    return 0
}

export { react, constReact, destructuringReact, constDestructuringReact }
