import { expect, test } from "vitest"
import { formatSourceCode } from "../../src/util/testing/sundry"

test("Function: formatSourceCode", () => {
    expect(
        formatSourceCode(`

            a

        `)
    ).toBe("a")

    expect(
        formatSourceCode(`
            
            a
            b
            c

        `)
    ).toBe("a\nb\nc")

    expect(
        formatSourceCode(`
            <div>
                <p>
                    ...
                </p>
            </div>
        `)
    ).toBe("<div>\n    <p>\n        ...\n    </p>\n</div>")

    expect(
        formatSourceCode(`
			<div>
				<p>
					xxx
				</p>
			</div>
		`)
    ).toBe("<div>\n\t<p>\n\t\txxx\n\t</p>\n</div>")
})
