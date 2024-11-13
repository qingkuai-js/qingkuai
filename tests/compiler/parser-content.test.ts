import { test, expect } from "vitest"
import { content2script } from "../../compiler/parser/content"

test("literal content", () => {
    expect(content2script("[1,2,3]")).toBe('"[1,2,3]"')
    expect(content2script("pre 'post'")).toBe(`"pre 'post'"`)
})

test("content with js expression", () => {
    expect(() => content2script("{")).toThrowError()
    expect(() => content2script("}{")).toThrowError()
    expect(content2script("}")).toBe('"}"')
    expect(content2script("{}}")).toBe('"}"')
    expect(content2script("{'{'}")).toBe("'{'")
    expect(content2script("'{}'")).toBe(`"'" + "'"`)
    expect(content2script("} {a} 1")).toBe(`"} " + a + " 1"`)
    expect(content2script("{{a} + {b}}")).toBe("{a} + {b}")
})

test("find closing character out of string and comment", () => {
    ;['"', "'", "`", "//", "/*", "/**"].forEach(c => {
        expect(() => content2script(`{${c}}`)).toThrowError()
    })
    expect(() => content2script("{{a} + b //' ... \n{'}")).toThrowError()

    expect(content2script("{a + '}' b}")).toBe("a + '}' b")
    expect(content2script("{a + `}` b}")).toBe("a + `}` b")
    expect(content2script('{a + "}" b}')).toBe('a + "}" b')
    expect(content2script("{a+/* ... */b}")).toBe("a+/* ... */b")
    expect(content2script("{a + /* } */ b}")).toBe("a + /* } */ b")
    expect(content2script("{a + b + // }\n}")).toBe("a + b + // }\n")
    expect(content2script("{{a} + b // ... \n}")).toBe("{a} + b // ... \n")
})
