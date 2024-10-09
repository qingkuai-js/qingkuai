import { parse } from "@babel/parser"

console.log(
    (
        parse("_=arguments", {
            plugins: ["typescript"]
        }).program.body[0] as any
    ).expression.right
)
