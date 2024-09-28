import type { QingKuaiComponent } from "./instance"
import type { TemplateStuOrModuleFunc } from "./types"

import { isFunction } from "../util/shared/assert"
import { AssignmentToProps } from "./message/warn"

// 获取已绑定组件实例的相关方法
export function init(instance: QingKuaiComponent) {
    const properties = instance.__
    return {
        // sts means Set Template Structure
        sts(ts: TemplateStuOrModuleFunc[]) {
            properties.ts = ts
        },
        slots: properties.slots,
        props: new Proxy(properties.props, {
            get(target, property: string) {
                const item = target[property]
                if (isFunction(item)) {
                    return item(properties.ctx)
                }
                return item
            },
            set() {
                return AssignmentToProps(), true
            }
        }),
        refs: new Proxy(properties.refs, {
            get(target, property: string) {
                return target[property][0](properties.ctx)
            },
            set(target, property: string, value: any) {
                return target[property][1](value, properties.ctx), true
            }
        })
    }
}
