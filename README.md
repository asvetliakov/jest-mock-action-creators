# Mock redux action creators with jest

## Why

You're cool. You're going to test your React smart components (aka containers in redux) and make assumptions what they call necessary redux action creators. Well, you can have few ways to achieve this:

### Path 1: action creators binding

```jsx

class Comp extends Component {
    render() {
        // some render... not important
    }

    onSomeButtonClick() {
        this.props.sendMyAction();
    }
}

function mapDispatchToProps(dispatch) {
    return { sendMyAction: bindActionCreators(dispatch, sendMyAction) }
};

```

then in test

```jsx
const spy = jest.fn();
shallow(<Comp sendMyAction={spy} />);
```

It works well in plain Javascript, but quickly becomes headache in Typescript:

```ts
interface Actions {
    sendMyAction: typeof sendMyAction; // What??
    sendMyOtherAction: typeof sendMyOtherAction;
    actions: typeof actionBundle;
}

class Comp extends Component<Actions> {
    // ....
}
```

You must to declare your actions here to not lose the function types, which is the boring task. Also, you may have some middleware which converts your action to promises/observables (very common case) and you'll probably be ended in declaring separate function types with promisified results.


### Path 2: By using injected ```dispatch()``` and call action creators directly

```jsx
import { sendMyAction } from "./actions";

class Comp extends Component {
    onSomeButtonClick() {
        this.props.dispatch(sendMyAction());
    }
}
```

This is also neat in Typescript (since you don't need to declare your actions in component props again) and you can do some tricks with generics and redux's ```dispatch()``` to automatically obtain correct result type from request action type. Nice!

Unfortunately this way has very big disadvantages when it comes to testing:

1. You're depending on actual action creator function in your component test, which is not very good (Action creator may have some logic additionally):
2. Hard to test
3. Not possible to test thunks action creators
4. In case if it will be handled by some middleware which will return different result (for ex. promise), you must mock your action creator

For example:

```js
function myAction(a, b) {
    return {
        type: "MY_ACTION",
        payload: {
            a: a === true ? "truthy": "falsy",
            b
        }
    }
}

class C extends Component {
    someButtonClick() {
        this.props.dispatch(myAction(true, 5));
    }
}
```

test:

```jsx
const dispatch = jest.fn();
const w = shallow(<Component dispatch={dispatch} />);
w.find("button").simulate("click");
```

1. You must assert your dispatch in test with something like:

```js
expect(dispatch).toBeCalledWith(myAction(true, 5));
// or
expect(dispatch).toBeCalledWith({ type: "MY_ACTION", payload: { a: "truthy", b: 5 }});
```
Variant 1 looks OK, but is not always achievable. For example if you have some param validation in your creator and throw error - it won't be possible to test it without mocking AC.

2. Thunk action creators won't work

```js
function myAction(a, b) {
    return dispatch => {
        dispatch(someOtherAction());
    }
}
```

```js
expect(dispatch).toBeCalledWith(myAction(true, 5));
```
Will always fail

3. Mocking action:

```js
class C extends Component {
    async someButtonClick() {
        const res = await this.props.dispatch(myAction(true, 5));
        // do something with res
        res.someval;
    }
}

//test

import { myAction } from "../actions";
jest.mock("../actions");

myAction.mockReturnValue({ someval: 1 });
```

Again, this will quickly become very boring if you have many actions creators and even much boring when using Typescript

## This library comes to resque:

```jsx
class C extends React.Component {
    render() {
        // some render
    }

    buttonClick() {
        this.props.dispatch(anotherAction("test"));
    }

    async anotherButtonClick() {
        const res = await this.props.dispatch(myAction(true, 5, "prop"));
        await this.props.dispatch(anotherAction(res.val));
    }
}
```

test:

```jsx
import { mockActionCreators, createDispatchMockImplementation } from "jest-mock-action-creators";
import { myAction } from "../myAction";
import { anotherAction } from "../anotherAction";

// Automatically mock your action creator modules. When using babel transformer it will insert jest.mock() for their module paths
mockActionCreators(myAction, anotherAction);
// or replaceActionCreators(myAction, anotherAction); // Doesn't insert jest.mock() for their module paths, expects myAction and anotherAction be already mocked (i.e. jest.fn())

const dispatch = jest.fn();
const wrapper = shallow(<C dispatch={dispatch} />);
wrapper.find("button").simulate("click");

// Pretty easy, isn't it?
expect(dispatch).toBeCalledWithActionCreator(anotherAction, "test");
expect(dispatch).not.toBeCalledWithActionCreator(myAction);

// Return { val: "test2" } when calling myAction();
createDispatchMockImplementation(dispatch, {
    [myAction.name]: { val: "test2" }
});

wrapper.find("anotherButton").simulate("click");
expect(dispatch).toBeCalledWithActionCreator(myAction, true, 5, "prop");
expect(dispatch).toBeCalledWithActionCreator(anotherAction, "test2");
```

## Installation

```npm install jest-mock-action-creators --save-dev```

Add ```jest-mock-action-creators/babel``` to your plugins in .babelrc or .babelrc.js

When using typescript and ```ts-jest```, enable babel processing in ```ts-jest``` (enabled by default) and tell it to use .babelrc:

```json
{
  "jest": {
    "globals": {
      "ts-jest": {
        "useBabelrc": true
      }
    }
  }
}
```

*Note*: Specifying ```plugins: []``` in ts-jest babel configuration won't work


and finally import in your test:

```js
import { mockActionCreators, createDispatchMockImplementation } from "jest-mock-action-creators";
```

## Want to mock only the specified action creators?

It's possible with using [jest-easy-mock](https://github.com/asvetliakov/babel-plugin-jest-easy-mock), use this configuration:

```js
        ["jest-easy-mock", {
            requireActual: true,
            identifiers: [
                {
                    name: "jest.mockObj",
                    remove: true,
                    type: "name",
                },
                {
                    name: "jest.mockFn",
                    remove: true,
                    type: "mock",
                },
                {
                    name: "replaceActionCreators",
                    remove: false,
                    type: "mock"
                }
            ]
        }],
        ["jest-mock-action-creators/babel", { mockIgnoreExpressions: ["mock", "doMock", "mockObj", "mockFn"] }],
```

and in the test:

```js
import { myAction, myAction2 } from "../actions";
import { ActionModule } from "../../module";

beforeEach(() => {
    replaceActionCreators(
        myAction,
        ActionModule.action1,
    );
});

it("test", () => {
    myAction(); // mocked
    myAction2(); // non-mocked

    ActionModule.action1(); // mocked
    ActionModule.action2(); // non-mocked
});

```