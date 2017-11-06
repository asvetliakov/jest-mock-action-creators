import * as b from "@babel/core";
import * as t from "@babel/types";
import * as bt from "@babel/traverse";

const globalJestIdentifier = "jest";
const jestMockCallExpressions = ["mock", "doMock"];
const requireIdentifier = "require";


export interface PluginState {
    /**
     * Mock action creators function name. It can be renamed during imports, for example
     */
    mockActionCreatorsName: string;
    /**
     * All import identifiers with local value => source name
     */
    importIdentifiers: Map<string, string>;
    /**
     * Existing jest mocks or already mocked action creators
     */
    existingJestMocks: string[];
    /**
     * Top-level program instance
     */
    program: bt.NodePath<t.Program>;
}

export default function plugin({ types: t }: typeof b): b.PluginObj<PluginState> {
    /**
     * Check if given call expression is jest mocking call
     *
     * @param node Node to check
     * @returns True if node is jest mock call expression
     */
    const isJestMockCallExpression = (node: t.CallExpression): boolean => {
        if (!t.isMemberExpression(node.callee)) {
            return false;
        }
        const { object, property } = node.callee;
        if (!t.isIdentifier(object) || !t.isIdentifier(property)) {
            return false;
        }
        if (object.name !== globalJestIdentifier || !jestMockCallExpressions.includes(property.name)) {
            return false;
        }
        return true;
    }

    /**
     * Check if given call expression is node's require() call
     *
     * @param node Node to check
     * @returns True if node is node's require() call
     */
    const isRequireCallExpression = (node: t.CallExpression): boolean => {
        if (!t.isIdentifier(node.callee)) {
            return false;
        }
        return node.callee.name === requireIdentifier;
    }

    /**
     * Build jest.mock() expression
     *
     * @param source Source name to embed into jest.mock()
     * @returns New jest.mock() expression
     */
    const buildJestMock = (source: string): t.ExpressionStatement => {
        return t.expressionStatement(t.callExpression(t.memberExpression(t.identifier(globalJestIdentifier), t.identifier("mock")), [t.stringLiteral(source)]));
    }

    /**
     * Check if given expression is plugin's mockActionCreators extension or similar
     *
     * @param node Node to check
     * @param funcName Callee name to check
     *
     * @returns True if it's mockActionCreators() like call
     */
    const isMockActionCreatorsCallExpression = (node: t.CallExpression, funcName: string): boolean => {
        if (t.isIdentifier(node.callee)) {
            // mockActionCreators()
            return node.callee.name === funcName;
        } else if (t.isMemberExpression(node.callee) && t.isIdentifier(node.callee.property)) {
            // possiblity:
            // import * as m from "jest-mock-action-creators";
            // m.mockActionCreators();
            return node.callee.property.name === funcName;
        }
        return false;
    }

    return {
        pre() {
            this.mockActionCreatorsName = "mockActionCreators";
            this.importIdentifiers = new Map();
            this.existingJestMocks = [];
        },
        visitor: {
            Program(path) {
                // store program to avoid parent lookup later
                this.program = path;
            },
            ImportDeclaration(path) {
                // process import declarations, easiest
                const specifiers = path.node.specifiers;
                for (const s of specifiers) {
                    if (t.isImportSpecifier(s)) {
                        // We may rename our function here
                        if (s.imported.name === this.mockActionCreatorsName && s.local.name !== s.imported.name) {
                            this.mockActionCreatorsName = s.local.name;
                        }
                    }
                    this.importIdentifiers.set(s.local.name, path.node.source.value);
                }
            },
            CallExpression(path) {
                const node = path.node;
                if (isRequireCallExpression(node)) {
                    // node's require() stuff
                    const parentNode = path.parent;
                    // not interested with simple require() without any assignment
                    if (!t.isVariableDeclarator(parentNode)) {
                        return;
                    }
                    // Drop non string literals
                    if (!node.arguments[0] || !t.isStringLiteral(node.arguments[0])) {
                        return;
                    }
                    const sourceName = (node.arguments[0] as t.StringLiteral).value;
                    // const a = require("b"); // Identifier
                    // const { b } = require("c"); // Object pattern
                    const variableId = parentNode.id;

                    if (t.isIdentifier(variableId)) {
                        this.importIdentifiers.set(variableId.name, sourceName);
                    } else if (t.isObjectPattern(variableId)) {
                        const props = variableId.properties;
                        // const { a, b, c, d } = require("a");
                        for (const prop of props) {
                            if (t.isProperty(prop) && t.isIdentifier(prop.value)) {
                                this.importIdentifiers.set(prop.value.name, sourceName);
                            }
                        }
                    }
                } else if (isJestMockCallExpression(node)) {
                    // need to remember existing jest.mock() and jest.doMock() to prevent mocking them again
                    const firstArg = node.arguments[0];
                    // jest.mock() requires string literal as first arg
                    if (!firstArg || !t.isStringLiteral(firstArg)) {
                        return;
                    }
                    this.existingJestMocks.push(firstArg.value);
                } else if (isMockActionCreatorsCallExpression(node, this.mockActionCreatorsName)) {
                    // Process actually our function
                    const mockIdentifiers: string[] = [];
                    for (const arg of node.arguments) {
                        // we're interested in identifiers and member expressions only
                        let name: string | undefined;
                        if (t.isIdentifier(arg)) {
                            name = arg.name;
                        } else if (t.isMemberExpression(arg)) {
                            if (t.isIdentifier(arg.object)) {
                                name = arg.object.name;
                            }
                        }
                        if (!name) {
                            continue;
                        }
                        const importSourceForIdentifier = this.importIdentifiers.get(name);
                        // skip identifiers which don't have import or if import for this identifier was already mocked
                        if (!importSourceForIdentifier || this.existingJestMocks.includes(importSourceForIdentifier)) {
                            continue;
                        }
                        // filter same identifiers
                        if (!mockIdentifiers.includes(name)) {
                            mockIdentifiers.push(name);
                        }
                    }
                    if (mockIdentifiers.length > 0) {
                        // get all sources for identifiers, exclude duplicates
                        const allSourcesToMock = [...this.importIdentifiers]
                            .filter(([identifier, ]) => mockIdentifiers.includes(identifier))
                            .map(([, source]) => source)
                            .filter((s, idx, arr) => !arr.includes(s, idx + 1))

                        if (this.program) {
                            // create mock records
                            allSourcesToMock.forEach(source =>
                                (this.program as any).unshiftContainer("body", buildJestMock(source))
                            );
                            // store new mocks
                            this.existingJestMocks.push(...allSourcesToMock);
                        }
                    }
                }
            }
        }
    }
}