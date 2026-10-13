const globalAny = global as any

if (typeof window === "undefined") {
    globalAny.document = undefined
}

globalAny.__qk__max_schedule_depth = 300
