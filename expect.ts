import { ActionCreatorInvokation } from "./";
import diff = require("jest-diff");

declare global {
    namespace jest {
        interface Matchers<R> {
            toBeCalledWithActionCreator(actionCreatorName: string | Function, ...args: any[]): void;
        }
    }
}

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

        const call = received.mock.calls.find((val: any[]) => {
            return val && val[0] && val[0].actionCreator === creatorName
        });
        const invokation: ActionCreatorInvokation | undefined = call ? call[0] : undefined;

        let pass = true;
        if (!invokation) {
            pass = false;
        } else if (args.length > 0) {
            try {
                expect(args).toEqual(invokation.args);
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
            if (!pass && !invokation) {
                return `${(this.utils.RECEIVED_COLOR as any)("But it never called it.")}`;
            }
            if (!pass && invokation) {
                if (invokation.args && invokation.args.length > 0) {
                    let msg =  `${(this.utils.RECEIVED_COLOR as any)("But it was called it with arguments: " + this.utils.stringify(invokation.args))}`;
                    if (args.length > 0) {
                        const diffStr = diff(args, invokation.args, { expand: (this as any).expand });
                        if (diffStr) {
                            msg += `\n\nDifference\n\n${diffStr}`;
                        }
                    }
                    return msg;
                } else {
                    return `${(this.utils.RECEIVED_COLOR as any)("But it was called it")}`;
                }
            }
            return `${(this.utils.RECEIVED_COLOR as any)("But it was called it")}`;
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