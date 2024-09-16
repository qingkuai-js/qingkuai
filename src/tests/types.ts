import type { TemplateNode } from "../compiler/types"

export type TemplateNodeParent = TemplateNode["parent"]
export type TemplateNodeAttributes = TemplateNode["attributes"]
export type ExpectTemplateNode = Omit<TemplateNode, "parent" | "children"> & {
    children: ExpectTemplateNode[]
}
