export enum PositionFlag {
    InScript = 1 << 0,
    InStyle = 1 << 1,
    Sourcemap = 1 << 2,
    IsAttributeStart = 1 << 3,
    IsComponentStart = 1 << 4,
    SourcemapEnd = (1 << 5) | PositionFlag.Sourcemap,
    SourcemapStart = (1 << 6) | PositionFlag.Sourcemap,
    isInterpolatedAttributeStart = (1 << 7) | PositionFlag.IsAttributeStart
}
