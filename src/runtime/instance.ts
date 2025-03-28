import type { GeneralFunc } from "../util/types"
import type { QingKuaiProperties, QingKuaiComponentConstructonParam } from "./types"

import { InstantiatedByH, nil, noop } from "./constants"
import { arrayFill, runAll } from "../util/shared/sundry"
import { InstantiateComponentManually } from "./message/error"
import { destroyBlock, newDestruction } from "../util/runtime/separate"

// 用于存储当前操作的组件实例
let currentInstance: QingKuaiComponent | null = nil

export class QingKuaiComponent {
    /**
     * - ts means Template Structure
     * - deps means all Dependencies of component
     * - dst means Destruction Methods of component
     * - hooks in order: onBeforeMount, onAfterMount,
     *   onBeforeUpdate, onAfterUpdate, onBeforeDestroy, onAfterDestroy
     */
    __: QingKuaiProperties = {
        updating: false,
        id: "",
        ts: [],
        deps: [],
        hooks: [],
        refs: {},
        slots: {},
        props: {},
        ctx: noop,
        context: [],
        dst: newDestruction()
    }

    constructor(args: QingKuaiComponentConstructonParam) {
        if (args.sign !== InstantiatedByH) {
            InstantiateComponentManually()
        }
        delete args.sign
        Object.assign(this.__, args)
        setCurrentInstance(this)
    }
}

// 获取当前组件实例（currentInstance）
export function getCurrentInstance() {
    return currentInstance
}

// 设置当前组件实例到currentInstance
export function setCurrentInstance(ins: QingKuaiComponent) {
    currentInstance = ins
}

// 销毁组件
export function destroyComponent(instance: QingKuaiComponent) {
    invokeIndexedHooks(instance, 4)
    destroyBlock(instance.__.dst)
    instance.__ = null as any
    invokeIndexedHooks(instance, 5)
}

// 调用某个组件对应索引下的所有钩子函数，index对应的钩子参见当前文件17-18行
export function invokeIndexedHooks(instance: QingKuaiComponent, index: number) {
    const container = instance.__.hooks[index]
    container && runAll(container)
}

// 由于所有声明周期钩子挂载方法相同，此函数批量注册这些方法
function hooksHandlerGen() {
    const ret = arrayFill(6, noop as (fn: GeneralFunc) => void)
    for (let i = 0; i < 6; i++) {
        ret[i] = (fn: GeneralFunc) => {
            const { hooks } = currentInstance!.__
            if (hooks[i]) {
                hooks[i].push(fn)
            } else {
                hooks[i] = [fn]
            }
        }
    }
    return ret
}

export const [
    onBeforeMount,
    onAfterMount,
    onBeforeUpdate,
    onAfterUpdate,
    onBeforeDestroy,
    onAfterDestroy
] = hooksHandlerGen()
