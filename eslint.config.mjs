import { defineConfig } from "eslint/config";
import next_core_web_vitals from "eslint-config-next/core-web-vitals";

const jsxTextIndentRule = {
    meta: {
        type: "layout",
        docs: {
            description: "Enforce indentation for multiline JSX text nodes"
        },
        fixable: "whitespace",
        schema: [{
            type: "integer",
            minimum: 0
        }],
        messages: {
            wrongIndent: "Expected JSX text indentation of {{expected}} spaces but found {{actual}}."
        }
    },
    create(context) {
        const sourceCode = context.sourceCode;
        const indentSize = typeof context.options[0] === "number" ? context.options[0] : 4;
        const reportedLineSet = new Set();

        return {
            JSXText(node) {
                const rawText = sourceCode.getText(node);
                if (!rawText.includes("\n")) {
                    return;
                }

                if (!node.parent || node.parent.type !== "JSXElement") {
                    return;
                }

                const parentIndent = node.parent.openingElement.loc.start.column;
                const expectedIndent = parentIndent + indentSize;
                const startLine = node.loc.start.line + 1;
                const endLine = node.loc.end.line;

                for (let line = startLine; line <= endLine; line += 1) {
                    const fullLine = sourceCode.lines[line - 1] || "";
                    const firstNonWhitespace = fullLine.search(/\S/u);

                    if (firstNonWhitespace === -1) {
                        continue;
                    }

                    const lineStartIndex = sourceCode.getIndexFromLoc({ line, column: 0 });
                    const firstTokenIndex = lineStartIndex + firstNonWhitespace;
                    if (firstTokenIndex < node.range[0] || firstTokenIndex >= node.range[1]) {
                        continue;
                    }

                    const reportKey = `${node.range[0]}:${line}`;
                    if (reportedLineSet.has(reportKey)) {
                        continue;
                    }

                    if (firstNonWhitespace !== expectedIndent) {
                        reportedLineSet.add(reportKey);
                        context.report({
                            node,
                            loc: {
                                start: { line, column: 0 },
                                end: { line, column: firstNonWhitespace }
                            },
                            messageId: "wrongIndent",
                            data: {
                                expected: expectedIndent,
                                actual: firstNonWhitespace
                            },
                            fix(fixer) {
                                return fixer.replaceTextRange(
                                    [lineStartIndex, lineStartIndex + firstNonWhitespace],
                                    " ".repeat(expectedIndent)
                                );
                            }
                        });
                    }
                }
            }
        };
    }
};

export default defineConfig([
    ...next_core_web_vitals,
    {
        files: ["{src,cli}/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
        plugins: {
            local: {
                rules: {
                    "jsx-text-indent": jsxTextIndentRule
                }
            }
        },
        rules: {
            indent: ["warn", 4],
            "@next/next/no-img-element": "off",
            "react-hooks/exhaustive-deps": "off",
            "react-hooks/set-state-in-effect": "off",
            "react-hooks/immutability": "off",
            "react-hooks/refs": "off",
            "react/jsx-closing-bracket-location": ["warn", "line-aligned"],
            "react/jsx-curly-newline": ["warn", {
                multiline: "consistent",
                singleline: "forbid"
            }],
            "local/jsx-text-indent": ["warn", 4],
            semi: ["warn", "never"],
            "object-curly-spacing": ["warn", "always"],
            "key-spacing": ["warn", {
                afterColon: true
            }],
            "comma-spacing": ["warn", {
                before: false,
                after: true
            }],
            "space-before-blocks": ["warn", "never"],
            "brace-style": ["warn", "stroustrup", {
                allowSingleLine: true
            }],
            "arrow-spacing": ["warn", {
                before: true,
                after: true
            }]
        }
    }
]);
