import { defineConfig } from "eslint/config";
import next_core_web_vitals from "eslint-config-next/core-web-vitals";
import path from "path";

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

const noEmojisRule = {
    meta: {
        type: "suggestion",
        docs: {
            description: "Enforce emoji prohibition in UI text and code"
        },
        messages: {
            noEmoji: "Do not use emojis in any UI text, icons, or code (emoji found: '{{emoji}}')."
        }
    },
    create(context) {
        // Range targeting common modern colorful emoji blocks (skips standard UI symbols like ✓, ✗, ✕)
        const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F000}-\u{1F0FF}\u{1F1E6}-\u{1F1FF}]/u;

        function checkText(node, text) {
            const match = text.match(emojiRegex);
            if (match) {
                context.report({
                    node,
                    messageId: "noEmoji",
                    data: {
                        emoji: match[0]
                    }
                });
            }
        }

        return {
            JSXText(node) {
                checkText(node, node.value);
            },
            Literal(node) {
                if (typeof node.value === "string") {
                    checkText(node, node.value);
                }
            },
            TemplateElement(node) {
                if (node.value && typeof node.value.cooked === "string") {
                    checkText(node, node.value.cooked);
                }
            }
        };
    }
};

const noInlineSvgsRule = {
    meta: {
        type: "suggestion",
        docs: {
            description: "Enforce SVG icon component centralization in icons.tsx"
        },
        messages: {
            noInlineSvg: "Do not use inline <svg> tags outside of icons.tsx. Write SVG components in the corresponding icons.tsx and import them instead."
        }
    },
    create(context) {
        const filename = context.filename || context.getFilename();
        const isIconFile = filename.endsWith("icons.tsx") || filename.endsWith("icons.ts");

        return {
            JSXOpeningElement(node) {
                if (node.name.name === "svg" && !isIconFile) {
                    context.report({
                        node,
                        messageId: "noInlineSvg"
                    });
                }
            }
        };
    }
};

const layeringRestrictionsRule = {
    meta: {
        type: "suggestion",
        docs: {
            description: "Enforce module dependency layering rules"
        },
        messages: {
            noComponentsToBlocks: "Layering violation: 'src/components/' must not depend on 'src/blocks/' or 'src/app/'.",
            noUiInNonUi: "Layering violation: Non-UI file '{{file}}' must not import UI-related directory '{{imported}}'."
        }
    },
    create(context) {
        const filename = context.filename || context.getFilename();
        const relativeFile = path.relative(process.cwd(), filename).replace(/\\/g, "/");

        const UI_DIRS = ["src/app/", "src/blocks/", "src/components/"];
        const isUiFile = UI_DIRS.some(dir => relativeFile.startsWith(dir));

        function getResolvedImport(importPath) {
            if (importPath.startsWith("@/")) {
                return importPath.replace("@/", "src/");
            }
            if (importPath.startsWith(".") || importPath.startsWith("/")) {
                const dirname = path.dirname(filename);
                const absolutePath = path.resolve(dirname, importPath);
                return path.relative(process.cwd(), absolutePath).replace(/\\/g, "/");
            }
            return importPath;
        }

        function checkImport(node, importSource) {
            const resolved = getResolvedImport(importSource);

            // 1. Non-UI files must NEVER import modules from UI-related directories
            if (!isUiFile) {
                const matchedUi = UI_DIRS.find(dir => resolved.startsWith(dir));
                if (matchedUi) {
                    context.report({
                        node,
                        messageId: "noUiInNonUi",
                        data: {
                            file: relativeFile,
                            imported: matchedUi
                        }
                    });
                }
            }

            // 2. src/components/ must not depend on src/blocks/ or src/app/
            if (relativeFile.startsWith("src/components/")) {
                if (resolved.startsWith("src/blocks/") || resolved.startsWith("src/app/")) {
                    context.report({
                        node,
                        messageId: "noComponentsToBlocks"
                    });
                }
            }
        }

        return {
            ImportDeclaration(node) {
                checkImport(node, node.source.value);
            },
            ImportExpression(node) {
                if (node.source && node.source.type === "Literal" && typeof node.source.value === "string") {
                    checkImport(node, node.source.value);
                }
            }
        };
    }
};

const namingConventionsRule = {
    meta: {
        type: "suggestion",
        docs: {
            description: "Enforce naming conventions from AGENTS.md"
        },
        messages: {
            invalidHook: "React hook '{{name}}' must be camelCase.",
            invalidType: "Type/Interface/Class/Enum '{{name}}' must be PascalCase.",
            invalidFunc: "Function/Method '{{name}}' must be snake_case (except React components/hooks).",
            invalidVar: "Variable '{{name}}' must be snake_case or SCREAMING_SNAKE_CASE (except PascalCase React components/Context/Refs)."
        }
    },
    create(context) {
        const isPascalCase = str => /^[A-Z][a-zA-Z0-9]*$/.test(str);
        const isCamelCase = str => /^[a-z][a-zA-Z0-9]*$/.test(str);
        const isSnakeCase = str => /^_?[a-z0-9]+(_[a-z0-9]+)*_?$/.test(str);

        const IGNORED_NAMES = new Set(["default", "React", "JSX", "HTML", "URL", "JSON", "UI"]);

        return {
            TSTypeAliasDeclaration(node) {
                const name = node.id.name;
                if (!isPascalCase(name)) {
                    context.report({ node: node.id, messageId: "invalidType", data: { name } });
                }
            },
            TSInterfaceDeclaration(node) {
                const name = node.id.name;
                if (!isPascalCase(name)) {
                    context.report({ node: node.id, messageId: "invalidType", data: { name } });
                }
            },
            ClassDeclaration(node) {
                if (node.id && node.id.name) {
                    const name = node.id.name;
                    if (!isPascalCase(name)) {
                        context.report({ node: node.id, messageId: "invalidType", data: { name } });
                    }
                }
            },
            TSEnumDeclaration(node) {
                const name = node.id.name;
                if (!isPascalCase(name)) {
                    context.report({ node: node.id, messageId: "invalidType", data: { name } });
                }
            },
            FunctionDeclaration(node) {
                if (!node.id || !node.id.name) return;
                const name = node.id.name;
                if (IGNORED_NAMES.has(name)) return;

                if (/^use[A-Z]/.test(name)) {
                    if (!isCamelCase(name)) {
                        context.report({ node: node.id, messageId: "invalidHook", data: { name } });
                    }
                } else if (isPascalCase(name)) {
                    // React Component, allowed
                } else {
                    if (!isSnakeCase(name)) {
                        context.report({ node: node.id, messageId: "invalidFunc", data: { name } });
                    }
                }
            },
            VariableDeclarator(node) {
                if (!node.id || node.id.type !== "Identifier") return;
                const name = node.id.name;
                if (IGNORED_NAMES.has(name)) return;

                if (/^use[A-Z]/.test(name)) {
                    if (!isCamelCase(name)) {
                        context.report({ node: node.id, messageId: "invalidHook", data: { name } });
                    }
                } else if (node.init && (node.init.type === "ArrowFunctionExpression" || node.init.type === "FunctionExpression")) {
                    if (isPascalCase(name)) {
                        // React Component, allowed
                    } else if (!isSnakeCase(name)) {
                        context.report({ node: node.id, messageId: "invalidFunc", data: { name } });
                    }
                }
            }
        };
    }
};

const noSyncSetStateInEffectRule = {
    meta: {
        type: "suggestion",
        docs: {
            description: "Disallow synchronous setState calls inside useEffect with non-empty dependencies"
        },
        messages: {
            syncSetState: "Do not call setState ('{{name}}') synchronously inside a useEffect with dependencies. Move this state synchronization logic to the render phase or trigger it via event handlers."
        }
    },
    create(context) {
        return {
            CallExpression(node) {
                if (node.callee.type !== "Identifier" || node.callee.name !== "useEffect") {
                    return;
                }

                const deps = node.arguments[1];
                if (!deps || deps.type !== "ArrayExpression" || deps.elements.length === 0) {
                    return;
                }

                const effectCallback = node.arguments[0];
                if (!effectCallback || (effectCallback.type !== "ArrowFunctionExpression" && effectCallback.type !== "FunctionExpression")) {
                    return;
                }

                function checkBlock(blockNode) {
                    if (!blockNode) return;
                    
                    const statements = blockNode.type === "BlockStatement" ? blockNode.body : [blockNode];
                    
                    for (const stmt of statements) {
                        if (stmt.type === "ExpressionStatement") {
                            const expr = stmt.expression;
                            if (expr.type === "CallExpression") {
                                checkCall(expr);
                            }
                        } else if (stmt.type === "IfStatement") {
                            checkBlock(stmt.consequent);
                            checkBlock(stmt.alternate);
                        } else if (stmt.type === "ForStatement" || stmt.type === "ForInStatement" || stmt.type === "ForOfStatement" || stmt.type === "WhileStatement" || stmt.type === "DoWhileStatement") {
                            checkBlock(stmt.body);
                        } else if (stmt.type === "SwitchStatement") {
                            for (const caseNode of stmt.cases) {
                                for (const subStmt of caseNode.consequent) {
                                    checkBlock(subStmt);
                                }
                            }
                        } else if (stmt.type === "BlockStatement") {
                            checkBlock(stmt);
                        }
                    }
                }

                function checkCall(callNode) {
                    if (callNode.callee.type === "Identifier") {
                        const name = callNode.callee.name;
                        if (/^set[A-Z_]/u.test(name)) {
                            context.report({
                                node: callNode,
                                messageId: "syncSetState",
                                data: { name }
                            });
                        }
                    }
                }

                if (effectCallback.body.type === "BlockStatement") {
                    checkBlock(effectCallback.body);
                } else if (effectCallback.body.type === "CallExpression") {
                    checkCall(effectCallback.body);
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
                    "jsx-text-indent": jsxTextIndentRule,
                    "no-emojis": noEmojisRule,
                    "no-inline-svgs": noInlineSvgsRule,
                    "layering-restrictions": layeringRestrictionsRule,
                    "naming-conventions": namingConventionsRule,
                    "no-sync-set-state-in-effect": noSyncSetStateInEffectRule
                }
            }
        },
        rules: {
            indent: ["warn", 4],
            "no-alert": "warn",
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
            "local/no-emojis": "warn",
            "local/no-inline-svgs": "warn",
            "local/layering-restrictions": "warn",
            "local/naming-conventions": "warn",
            "local/no-sync-set-state-in-effect": "warn",
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
