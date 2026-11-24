export enum TestingMode {
    None,
    Unit,
    E2e,
}

export enum RawArgumentKind {
    Unwrap,
    Plain,
}

export enum ParseDiatnosticDealtKind {
    Record,
    Ignore,
    Thrown,
}

export enum AnalyzeExpressionType {
    Component,
    Attribute,
}

export enum HtmlDirectivePlacementKind {
    Slot,
    Component,
}

export enum ReferenceBindingType {
    Getter,
    Setter,
    Both,
}

export enum SelectorExpressionType {
    Prev,
    Next,
}

export enum CompileMessageType {
    Error = "error",
    Warning = "warning",
}

export enum ReactivityMode {
    Reactive = "reactive",
    Shallow = "shallow",
}

export enum NamespaceMode {
    Inherited = "inherited",
    Svg = "svg",
    Html = "html",
}

export enum WhitespaceMode {
    Preserve = "preserve",
    Trim = "trim",
    Collapse = "collapse",
    TrimCollapse = "trim-collapse",
}

export enum IdentifierStatus {
    Reactive = "reactive",
    Raw = "raw",
    Shallow = "shallow",
    Derived = "derived",
    Pending = "pending",
    Alias = "alias",
    Literal = "literal",
}

export enum InlayHintKind {
    Variable = "variable",
    Function = "function",
    Class = "class",
    Enum = "enum",
}

export enum AttributeValueEnclosure {
    Single = "single",
    Double = "double",
    Curly = "curly",
    None = "none",
}

export enum SelectorOperationMethod {
    SetText = "setText",
    SetAttribute = "setAttribute",
    SetHtmlAttribute = "setHtmlAttribute",
    SetXlinkAttribute = "setXlinkAttribute",
    SetHtmlClassName = "setHtmlClassName",
    SetClassAttribute = "setClassAttribute",
}

export enum NodeContextFlag {
    InTopLevel = 1 << 0,
    InFunction = 1 << 1,
    ScopeBoundary = 1 << 2,
    BindingReference = 1 << 3,
    NonHoistableScopeBoundary = 1 << 4,
}

export enum PositionFlag {
    InScript = 1 << 0,
    InStyle = 1 << 1,
    Sourcemap = 1 << 2,
    IsAttributeStart = 1 << 3,
    IsComponentStart = 1 << 4,
    ContextIdentifier = 1 << 5,
    SourcemapEnd = (1 << 6) | PositionFlag.Sourcemap,
    SourcemapStart = (1 << 7) | PositionFlag.Sourcemap,
    isInterpolatedAttributeStart = (1 << 8) | PositionFlag.IsAttributeStart,
}
