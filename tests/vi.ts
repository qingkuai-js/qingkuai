import { vi } from "vitest"

export const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
