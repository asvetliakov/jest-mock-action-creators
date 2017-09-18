import { createDispatchMockImplementation, mockActionCreators } from "./";

it("Creates action creator invokation for given functions or function map", () => {
    const ac1 = jest.fn();
    Object.defineProperty(ac1, "name", { value: "ac1" });
    const ac2 = jest.fn();
    Object.defineProperty(ac2, "name", { value: "ac2" });
    const actions = {
        a: jest.fn(),
        b: jest.fn()
    };

    mockActionCreators(ac1, ac2, actions);

    const res = ac1("arg1", true);
    const res2 = ac2("arg2", false);
    const res3 = actions.a({ a: "hello" });
    const res4 = actions.b({ a: "world", world: true });

    expect(res).toMatchSnapshot();
    expect(res2).toMatchSnapshot();
    expect(res3).toMatchSnapshot();
    expect(res4).toMatchSnapshot();
});

it("Creates dispatch implementation for mocked creators", () => {
    const ac1 = jest.fn();
    Object.defineProperty(ac1, "name", { value: "ac1" });
    const ac2 = jest.fn();
    Object.defineProperty(ac2, "name", { value: "ac2" });
    const actions = {
        a: jest.fn(),
        b: jest.fn()
    };

    mockActionCreators(ac1, ac2, actions);

    const dispatch = jest.fn();

    createDispatchMockImplementation(dispatch, {
        [ac1.name]: 10,
        [ac2.name]: "value",
        a: { a: true },
        b: true
    });

    const res1 = dispatch(ac1());
    const res2 = dispatch(ac2());
    const res3 = dispatch(actions.a());
    const res4 = dispatch(actions.b());

    expect(res1).toBe(10);
    expect(res2).toBe("value");
    expect(res3).toEqual({ a: true });
    expect(res4).toBe(true);
});