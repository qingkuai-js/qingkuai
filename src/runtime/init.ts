import type { AnyObject } from "../util/types"
import type { QingKuaiComponent } from "./instance"
import type { TemplateStuOrModuleFunc } from "./types"

import { IS_PROXY, RAW_VALUE } from "./constants"
import { isFunction } from "../util/shared/assert"
import { AssignmentToProps, PropertyNotInRefs } from "./message/warn"

// 获取已绑定组件实例的相关方法
export function init(instance: QingKuaiComponent, hashId: string) {
    const properties = instance.__
    const { props, refs }: any = properties
    properties.id = hashId

    // refs的原始值表示（可阅读形式）
    const rawRefs = Object.keys(refs).reduce((p, c) => {
        return {
            ...p,
            [c]: refs[c][0](properties.ctx)
        }
    }, {} as AnyObject)

    // props的原始值表示（可阅读形式）
    const rawProps = Object.keys(props).reduce((p, c) => {
        const value = props[c]
        return {
            ...p,
            [c]: isFunction(value) ? value(properties.ctx) : value
        }
    }, {} as AnyObject)

    return {
        // sts: Set Component Template Structure
        scts(ts: TemplateStuOrModuleFunc[]) {
            properties.ts = ts
        },

        // 编译器生成的init调用会将props和refs解构声明到组件构造函数的顶部作用域
        props: new Proxy(
            {},
            {
                get(_, property) {
                    if (property === IS_PROXY) {
                        return true
                    }
                    if (property === RAW_VALUE) {
                        return rawProps
                    }

                    const v = props[property]
                    return isFunction(v) ? v(properties.ctx) : v
                },
                set() {
                    return AssignmentToProps(), true
                }
            }
        ),

        refs: new Proxy(
            {},
            {
                get(_, property) {
                    if (property === IS_PROXY) {
                        return true
                    }
                    if (property === RAW_VALUE) {
                        return rawRefs
                    }
                    return refs[property]?.[0](properties.ctx)
                },
                set(_, property, value) {
                    if (property in refs) {
                        refs[property][1](value, properties.ctx)
                    } else {
                        PropertyNotInRefs(property)
                    }
                    return true
                }
            }
        )
    }
}
