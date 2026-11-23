import { test } from "vitest";
import { analyzeTemplateAndMatchMessages } from "./_match";
import { formatSourceCode } from "../../../../src/util/shared/sundry";

test("rejects assigning to a destructured context identifier", () => {
    analyzeTemplateAndMatchMessages(
        formatSourceCode(`
            <lang-js>
                let rows = []
            </lang-js>
            <ul>
                <li #for={{ label } of rows}>
                    <button @click={() => label = "changed"}>change</button>
                </li>
            </ul>
        `),
        [
            {
                type: "error",
                range: [108, 113],
                value: `Cannot assign to context identifier "label" because it is a read-only binding.`,
            },
        ],
    );
});

test("rejects assigning to a #for context item", () => {
    analyzeTemplateAndMatchMessages(
        formatSourceCode(`
            <lang-js>
                let rows = []
            </lang-js>
            <ul>
                <li #for={item of rows}>
                    <button @click={() => item = "changed"}>change</button>
                </li>
            </ul>
        `),
        [
            {
                type: "error",
                range: [103, 107],
                value: `Cannot assign to context identifier "item" because it is a read-only binding.`,
            },
        ],
    );
});

test("rejects updating a destructured context identifier", () => {
    analyzeTemplateAndMatchMessages(
        formatSourceCode(`
            <lang-js>
                let rows = []
            </lang-js>
            <ul>
                <li #for={{ label } of rows}>
                    <button @click={() => label++}>change</button>
                </li>
            </ul>
        `),
        [
            {
                type: "error",
                range: [108, 113],
                value: `Cannot assign to context identifier "label" because it is a read-only binding.`,
            },
        ],
    );
});

test("rejects assigning a current row context identifier in #key", () => {
    analyzeTemplateAndMatchMessages(
        formatSourceCode(`
            <lang-js>
                let rows = []
            </lang-js>
            <ul>
                <li #for={{ label } of rows} #key={label = "changed"}>row</li>
            </ul>
        `),
        [
            {
                type: "error",
                range: [83, 88],
                value: `Cannot assign to context identifier "label" because it is a read-only binding.`,
            },
        ],
    );
});

test("rejects a reference attribute directly targeting a context identifier", () => {
    analyzeTemplateAndMatchMessages(
        formatSourceCode(`
            <lang-js>
                let rows = []
            </lang-js>
            <ul>
                <li #for={{ label } of rows} #key={label}>
                    <input &value={label} />
                </li>
            </ul>
        `),
        [
            {
                type: "error",
                range: [114, 119],
                value: `Cannot assign to context identifier "label" because it is a read-only binding.`,
            },
        ],
    );
});

test("allows reference attributes whose write target is a property path", () => {
    analyzeTemplateAndMatchMessages(
        formatSourceCode(`
            <lang-js>
                let rows = []
            </lang-js>
            <ul>
                <li #for={{ label } of rows} #key={label}>
                    <input &value={label.value} />
                </li>
            </ul>
        `),
        [],
    );
});

test("allows assigning properties of a non-destructured row", () => {
    analyzeTemplateAndMatchMessages(
        formatSourceCode(`
            <lang-js>
                let rows = []
            </lang-js>
            <ul>
                <li #for={row of rows} #key={row.id}>
                    <input &value={row.label} />
                    <button @click={() => row.label = "changed"}>change</button>
                </li>
            </ul>
        `),
        [],
    );
});
