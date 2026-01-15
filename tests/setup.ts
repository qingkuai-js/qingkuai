const globalAny = global as any

if (typeof window === "undefined") {
    globalAny.document = undefined
}

globalAny.__qk_max_schedule_depth = 300
globalAny.__qk_expose_destruction = true
