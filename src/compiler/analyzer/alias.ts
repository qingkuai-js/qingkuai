import { fullInitItems, fullRuntimeItems } from "../constants"
import { allExistingIdentifiers, usedInitItems, usedRuntimeItems } from "../state"

const aliases = new Map<string, string>()

// 确定标识符别名，分为以下两部分：
// 1. runtime/internal 导入标识符
// 3. init方法返回对象解构的属性名（scts)及组件constructor参数名(args)
// 注意：此方法的运行时机应该在分析（analyze）完成后且转换（transform）开始前，另外，此方法建立在
// 以上三类标识符列表中不存在相同元素的基础上运行，若之后存在相同元素，需重新考虑标识符别名的确定逻辑
export function confirmQingKuaiIdentifierAliases() {
    ;[fullRuntimeItems, fullInitItems].forEach(items => {
        items.forEach(item => {
            let alias: string = item
            while (allExistingIdentifiers.has(alias)) {
                alias = "_" + alias
            }
            if (alias !== item) {
                aliases.set(item, alias)
            }
        })
    })

    // 记录固定标识符
    getAlias("scts")
    getAlias("init")
    getAlias("QingKuaiComponent")
}

// 获取确定别名后的标识符
export function getAlias(key: string, shouldRecord = true) {
    const aliasKey = aliases.get(key)

    const isInitItem = (k: any) => {
        return fullInitItems.has(k)
    }

    const isRuntimeItem = (k: any) => {
        return fullRuntimeItems.has(k)
    }

    if (shouldRecord) {
        const isInit = isInitItem(key)
        const isRuntime = isRuntimeItem(key)
        if (aliasKey) {
            if (isInit) {
                key = `${key}: ${aliasKey}`
            } else if (isRuntime) {
                key = `${key} as ${aliasKey}`
            }
        }
        if (isInit) {
            usedInitItems.add(key)
        } else if (isRuntime) {
            usedRuntimeItems.add(key)
        }
    }
    return aliasKey || key
}
