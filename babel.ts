import * as b from "babel-core";
import * as t from "babel-types";
import * as bt from "babel-traverse";

const globalJestIdentifier = "jest";
const jestMockCallExpressions = ["mock", "doMock"];
const requireIdentifier = "require";

/**
 * Check if given call expression is jest mocking call
 * 
 * @param node Node to check
 * @returns True if node is jest mock call expression
 */
function isJestMockCallExpression(node: t.CallExpression): boolean {
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
function isRequireCallExpression(node: t.CallExpression): boolean {
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
function buildJestMock(source: string): t.ExpressionStatement {
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
function isMockActionCreatorsCallExpression(node: t.CallExpression, funcName: string): boolean {
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

/**
 * Plugin itself
 */
export default function plugin({ types: t }: typeof b): b.PluginObj {
    // Mock action creators function name. It can be renamed during imports, for example
    // import { mockActionCreators as m } from "jest-mock-action-creators";
    let mockActionCreatorsName = "mockActionCreators";
    // All import identifiers with local value => source name
    const importIdentifiers = new Map<string, string>();
    // Existing jest mocks
    const existingJestMocks: string[] = [];
    // Program to store
    let program: bt.NodePath<t.Program>;
    return {
        inherits: require("babel-plugin-syntax-jsx"),
        visitor: {
            Program(path) {
                // store program since to avoid parent lookup later
                program = path;
            },
            ImportDeclaration(path) {
                // process import declarations, pretty easy here
                const specifiers = path.node.specifiers;
                for (const s of specifiers) {
                    if (t.isImportSpecifier(s)) {
                        // We may rename our function here
                        if (s.imported.name === mockActionCreatorsName && s.local.name !== s.imported.name) {
                            mockActionCreatorsName = s.local.name;
                        }
                    }
                    importIdentifiers.set(s.local.name, path.node.source.value);
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
                        importIdentifiers.set(variableId.name, sourceName);
                    } else if (t.isObjectPattern(variableId)) {
                        const props = variableId.properties;
                        // const { a, b, c, d } = require("a");
                        for (const prop of props) {
                            if (t.isProperty(prop) && t.isIdentifier(prop.value)) {
                                importIdentifiers.set(prop.value.name, sourceName);
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
                    existingJestMocks.push(firstArg.value);
                } else if (isMockActionCreatorsCallExpression(node, mockActionCreatorsName)) {
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
                        const importSourceForIdentifier = importIdentifiers.get(name);
                        // skip identifiers which don't have import or if import for this identifier was already mocked
                        if (!importSourceForIdentifier || existingJestMocks.indexOf(importSourceForIdentifier) !== -1) {
                            continue;
                        }
                        // filter same identifiers
                        if (!mockIdentifiers.includes(name)) {
                            mockIdentifiers.push(name);
                        }
                    }
                    if (mockIdentifiers.length > 0) {
                        // get all sources for identifiers, exclude duplicates
                        const allSourcesToMock = [...importIdentifiers]
                            .filter(([identifier, ]) => mockIdentifiers.includes(identifier))
                            .map(([, source]) => source)
                            .filter((s, idx, arr) => !arr.includes(s, idx + 1))

                        if (program) {
                            // create mock records
                            allSourcesToMock.forEach(source =>
                                program.node.body.unshift(buildJestMock(source))
                                // docs are saying to use unshiftContainer but it's undefined??
                                // (program.get("body") as any).unshiftContainer("body", buildJestMock(source)))
                            );
                            // store new mocks
                            existingJestMocks.push(...allSourcesToMock);
                        }
                    }
                }
            }
        }
    }
}