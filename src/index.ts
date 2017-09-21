import diff = require("jest-diff");

export interface ActionCreatorInvokation {
    /**
     * Action creator function name
     */
    actionCreator: string;
    /**
     * Action creator arguments
     */
    args?: any[];
}

/**
 * Mock given action creators to use them with expect(dispatch).tobeCalledWithActionCreator()
 * 
 * @export
 * @param actionCreators 
 */
export function mockActionCreators(...actionCreators: Array<Function | { [key: string]: Function }>): void {
    const createNewImplementation = (name: string) => (...args: any[]) => {
        const invokation: ActionCreatorInvokation = {
            actionCreator: name,
            args: args
        };
        return invokation;
    };
    const allActionCreators = actionCreators.reduce((prev, curr) =>
        typeof curr === "function"
            ? prev.concat(curr)
            : prev.concat(Object.keys(curr).map(k => curr[k])),
        [] as Function[]
    );
    allActionCreators.forEach(f => {
        if (!(f as jest.Mock<any>).mock) {
            throw new Error(`Action creator is not mocked: ${f.name}`);
        }
        (f as jest.Mock<any>).mockImplementation(createNewImplementation(f.name))
    });
}

/**
 * Create dispatch implementation with given expectations
 * 
 * @export
 * @param dispatch Mocked dispatch function
 * @param expectations Expectations object. Key is the action creator function name, value is the result
 */
export function createDispatchMockImplementation(dispatch: Function, expectations: { [key: string]: any }, logWithoutExpectation: boolean = true): void {
    (dispatch as jest.Mock<any>).mockImplementation((action: ActionCreatorInvokation) => {
        if (action && action.actionCreator) {
            if (typeof expectations[action.actionCreator] !== "undefined") {
                return expectations[action.actionCreator];
            } else {
                if (logWithoutExpectation) {
                    console.warn(`Calling dispatch() with action creator without expectation: ${action.actionCreator}`);
                    const err = new Error("Error");
                    if (err.stack) {
                        const traces = err.stack.split("\n");
                        if (traces.length > 3) {
                            // Last related call is four or five in the stack
                            const lastCall = traces[0].match(/Error/) ? traces[4] : traces[3];
                            console.warn(`Last call is: ${lastCall}`);
                        }
                    }
                }
            }
        }
        return undefined;
    });
}

declare global {
    namespace jest {
        interface Matchers<R> {
            toBeCalledWithActionCreator(actionCreatorName: string | Function, ...args: any[]): void;
        }
    }
}

// Extend expect automatically when importing
expect.extend({
    toBeCalledWithActionCreator(received: jest.Mock<any>, actionCreatorName: string | Function, ...args: any[]): { message(): string, pass: boolean } {
        if (!received || !received.mock) {
            throw new Error(
                this.utils.matcherHint("[.not].toBeCalledWithActionCreator", "dispatch", "") +
                "\n\n" +
                `${(this.utils.RECEIVED_COLOR as any)("dispatch")} value must be a mock function or spy.\n` +
                this.utils.printWithType("Received", received, val => (this.utils.RECEIVED_COLOR as any)(this.utils.stringify(val)))
            );
        }

        if (typeof actionCreatorName !== "string" && typeof actionCreatorName !== "function") {
            throw new Error(
                this.utils.matcherHint("[.not].toBeCalledWithActionCreator", "dispatch", "actionCreator") +
                "\n\n" +
                `${(this.utils.EXPECTED_COLOR as any)("actionCreator")} must be a string or function.\n` +
                "Received: " + this.utils.printReceived(typeof actionCreatorName)
            );
        }

        const creatorName = typeof actionCreatorName === "function" ? actionCreatorName.name : actionCreatorName;

        const calls: ActionCreatorInvokation[] = received.mock.calls
            .filter((val: any) => val && val[0] && val[0].actionCreator === creatorName)
            .map(v => v[0]);

        const lastInvokation: ActionCreatorInvokation | undefined = calls.slice(-1)[0];
        const allInvokationArguments = calls.map(c => c.args).filter(a => !!a) as any[];

        let pass = true;
        if (calls.length === 0) {
            pass = false;
        } else if (args.length > 0) {
            try {
                expect(allInvokationArguments).toContainEqual(args);
            } catch {
                pass = false;
            }
        }

        const formatExpected = (): string => {
            let msg = `Expected dispatch() ${this.utils.printExpected(pass ? "to not call" : "to call")} action creator ${this.utils.printExpected(creatorName)}\n`;
            if (args.length > 0) {
                msg += `  With arguments: ${(this.utils.EXPECTED_COLOR as any)(this.utils.stringify(args))}\n`;
            }
            return msg;
        }

        const formatReceived = (): string => {
            if (!pass && calls.length === 0) {
                return `${(this.utils.RECEIVED_COLOR as any)("But it never called it.")}`;
            }
            if (!pass && calls.length > 0) {
                if (allInvokationArguments.length > 0) {
                    let msg =  `${(this.utils.RECEIVED_COLOR as any)(`But it called it ${calls.length} times with arguments: ` + this.utils.stringify(allInvokationArguments))}`;
                    if (args.length > 0) {
                        const diffStr = diff(args, allInvokationArguments.slice(-1)[0], { expand: (this as any).expand });
                        if (diffStr) {
                            msg += `\n\nLast call difference\n\n${diffStr}`;
                        }
                    }
                    return msg;
                } else {
                    return `${(this.utils.RECEIVED_COLOR as any)("But it called it")}`;
                }
            }
            return `${(this.utils.RECEIVED_COLOR as any)("But it called it")}`;
        }

        const message = pass
            ? () => this.utils.matcherHint(".not.toBeCalledWithActionCreator", "dispatch", creatorName) + "\n\n" +
                `${formatExpected()}\n` +
                `  ${formatReceived()}`
            : () => this.utils.matcherHint(".toBeCalledWithActionCreator", "dispatch", creatorName) + "\n\n" +
                `${formatExpected()}\n` +
                `  ${formatReceived()}`;
        return {
            message,
            pass
        };
    }
});