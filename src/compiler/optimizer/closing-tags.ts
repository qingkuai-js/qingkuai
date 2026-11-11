import type { TemplateFragment } from "#type-declarations/compiler";

import { NamespaceMode } from "../enums";
import { startTagNameRE, tagNameRE } from "../regular";
import { HTML_ONLY_TAGS, ALWAYS_CLOSE_TAGS, OPTIONAL_END_TAG_FOLLOWERS } from "../constants";

export function trimClosingTags(fragments: TemplateFragment[]) {
    for (const fragment of fragments) {
        omitConsecutiveClosingTags(fragment);
        omitTrailingClosingTags(fragment);
    }
}

// 连续的结束标签里，除最后一个之外都可以省略
// In a run of closing tags, all but the last one can be omitted
function omitConsecutiveClosingTags(fragment: TemplateFragment) {
    if (!isHtmlOmittableFragment(fragment)) {
        return;
    }

    let i = 0;
    const content = fragment.content;
    while (i < content.length) {
        if (!isClosingTag(content[i].value)) {
            i++;
            continue;
        }

        let j = i;
        const chain: number[] = [];
        while (j < content.length) {
            const value = content[j].value;
            if (!value) {
                j++;
                continue;
            }
            if (!isClosingTag(value)) {
                break;
            }
            chain.push(j++);
        }
        if (chain.length > 1) {
            const keptTag = getClosingTagName(content[chain[chain.length - 1]].value);
            for (let k = 0; k < chain.length - 1; k++) {
                const tag = getClosingTagName(content[chain[k]].value);
                if (tag !== keptTag && !ALWAYS_CLOSE_TAGS.has(tag)) {
                    content[chain[k]].value = "";
                }
            }
        } else if (chain.length === 1) {
            const index = chain[0];
            const tag = getClosingTagName(content[index].value);
            const followers = OPTIONAL_END_TAG_FOLLOWERS[tag];
            if (followers) {
                let next = index + 1;
                while (next < content.length && !content[next].value) {
                    next++;
                }

                const matched = startTagNameRE.exec(content[next]?.value ?? "");
                if (matched && followers.has(matched[1].toLowerCase())) {
                    content[index].value = "";
                }
            }
        }
        i = j;
    }
}

// 片段末尾的结束标签链可以整条省略
// A run of closing tags at the end of a fragment can be omitted in its entirety
function omitTrailingClosingTags(fragment: TemplateFragment) {
    if (!isHtmlOmittableFragment(fragment)) {
        return;
    }

    const content = fragment.content;
    for (let i = content.length - 1; i >= 0; i--) {
        const value = content[i].value;
        if (!value) {
            continue;
        }
        if (!isClosingTag(value)) {
            break;
        }
        content[i].value = "";
    }
}

function isHtmlOmittableFragment(fragment: TemplateFragment) {
    if (fragment.namespaceMode === NamespaceMode.Svg) {
        return false;
    }

    let containsHtmlOnlyTag = false;
    for (const item of fragment.content) {
        const matched = tagNameRE.exec(item.value);
        if (!matched) {
            continue;
        }

        const tag = matched[1].toLowerCase();
        if (tag === "svg" || tag === "math") {
            return false;
        }
        if (HTML_ONLY_TAGS.has(tag)) {
            containsHtmlOnlyTag = true;
        }
    }
    return fragment.namespaceMode === NamespaceMode.Html || containsHtmlOnlyTag;
}

function getClosingTagName(value: string) {
    return value.slice(2, -1).toLowerCase();
}

function isClosingTag(value: string) {
    return value.length > 3 && value[0] === "<" && value[1] === "/";
}
