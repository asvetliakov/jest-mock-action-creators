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
    for (const actionCreator of actionCreators) {
        if (typeof actionCreator === "object") {
            for (const key of Object.keys(actionCreator)) {
                (actionCreator[key] as jest.Mock<Function>).mockImplementation(createNewImplementation(key));
            }
        } else {
            (actionCreator as jest.Mock<Function>).mockImplementation(createNewImplementation(actionCreator.name));
        }
    }
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