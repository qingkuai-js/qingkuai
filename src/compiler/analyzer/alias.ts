import { fullInitItems, fullRuntimeItems } from "../constants"
import { allExistingIdentifiers, initItems, runtimeItems } from "../state"

const aliases = new Map<string, string>()

export function confirmAliases() {
    // 确定运行时导入项目别名
    fullRuntimeItems.forEach(item => {
        let alias: string = item
        while (allExistingIdentifiers.has(alias)) {
            alias = "_" + alias
        }
        if (alias !== item) {
            aliases.set(item, alias)
        }
    })

    // 确定init方法返回对象的属性别名
    fullInitItems.forEach(item => {
        let alias: string = item
        while (allExistingIdentifiers.has(alias)) {
            alias = "_" + alias
        }
        if (alias !== item) {
            aliases.set(item, alias)
        }
    })
}

// 获取导入项或init变量别名
export function getAlias(key: string, shouldRecord = true) {
    const aliasKey = aliases.get(key)

    const isInitItem = (k: typeof key) => {
        return fullInitItems.has(k as any)
    }

    const isRuntimeItem = (k: typeof key) => {
        return fullRuntimeItems.has(k as any)
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
            initItems.add(key)
        } else if (isRuntime) {
            runtimeItems.add(key)
        }
    }
    return aliasKey || key
}
