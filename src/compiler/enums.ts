export enum PositionFlag {
    InScript = 1 << 0,
    InStyle = 1 << 1,
    Sourcemap = 1 << 2,
    SourcemapStart = 1 << 3,
    SourcemapEnd = 1 << 4,
    IsAttributeStart = 1 << 5,
    IsComponentStart = 1 << 6
}
