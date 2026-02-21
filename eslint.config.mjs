import { defineConfig } from "eslint/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

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

export default defineConfig([{
    files: ["src/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    extends: compat.extends("next/core-web-vitals", "next/typescript"),
    plugins: {
        local: {
            rules: {
                "jsx-text-indent": jsxTextIndentRule
            }
        }
    },
    rules: {
        indent: ["warn", 4],
        "react/jsx-closing-bracket-location": ["warn", "line-aligned"],
        "react/jsx-curly-newline": ["warn", {
            multiline: "consistent",
            singleline: "forbid"
        }],
        "local/jsx-text-indent": ["warn", 4],
        semi: ["warn", "never"]
    }
}]);
