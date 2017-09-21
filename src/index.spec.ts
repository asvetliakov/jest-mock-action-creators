import { createDispatchMockImplementation, mockActionCreators } from "./";

describe("mockActionCreators()", () => {
    it("Creates action creator invokation for given functions or function map", () => {
        const ac1 = jest.fn();
        Object.defineProperty(ac1, "name", { value: "ac1" });
        const ac2 = jest.fn();
        Object.defineProperty(ac2, "name", { value: "ac2" });
        const actions = {
            a: jest.fn(),
            b: jest.fn()
        };
        Object.defineProperty(actions.a, "name", { value: "a" });
        Object.defineProperty(actions.b, "name", { value: "b" });

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

    it("Throws if encounters non mocked function", () => {
        const ac1 = jest.fn();
        Object.defineProperty(ac1, "name", { value: "ac1" });

        function ac2() { };
        expect(() => mockActionCreators(ac1, ac2)).toThrowError();
        expect(() => mockActionCreators(ac1, { ac2 })).toThrowError();
    });
})


it("Creates dispatch implementation for mocked creators", () => {
    const ac1 = jest.fn();
    Object.defineProperty(ac1, "name", { value: "ac1" });
    const ac2 = jest.fn();
    Object.defineProperty(ac2, "name", { value: "ac2" });
    const actions = {
        a: jest.fn(),
        b: jest.fn()
    };
    Object.defineProperty(actions.a, "name", { value: "a" });
    Object.defineProperty(actions.b, "name", { value: "b" });

    mockActionCreators(ac1, ac2, actions);

    const dispatch = jest.fn();

    createDispatchMockImplementation(dispatch, {
        [ac1.name]: 10,
        [ac2.name]: "value",
        [actions.a.name]: { a: true },
        [actions.b.name]: true
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

describe("toBeCalledWithActionCreator", () => {
    it("Throws if calling with non mocked dispatch", () => {
        const f = () => { };

        expect(() => expect(f).toBeCalledWithActionCreator("abc")).toThrowErrorMatchingSnapshot();
    });

    it("Throws if action creator name is not a string or function", () => {
        const dis = jest.fn();
        expect(() => expect(dis).toBeCalledWithActionCreator(true as any)).toThrowErrorMatchingSnapshot();
        expect(() => expect(dis).toBeCalledWithActionCreator({} as any)).toThrowErrorMatchingSnapshot();
    });

    describe("Checks invokations", () => {
        let dis: jest.Mock<any>;
        let ac1: jest.Mock<any>;
        let ac2: jest.Mock<any>;
        beforeEach(() => {
            ac1 = jest.fn();
            Object.defineProperty(ac1, "name", { value: "ac1" });
            ac2 = jest.fn();
            Object.defineProperty(ac2, "name", { value: "ac2" });

            mockActionCreators(ac1, ac2);

            dis = jest.fn();

            dis(ac1("a", "b", true));
        });

        it("Checks for just name without arguments", () => {
            expect(dis).toBeCalledWithActionCreator(ac1);
            expect(dis).not.toBeCalledWithActionCreator(ac2);
            expect(() => expect(dis).not.toBeCalledWithActionCreator(ac1)).toThrowErrorMatchingSnapshot();
            expect(() => expect(dis).toBeCalledWithActionCreator(ac2)).toThrowErrorMatchingSnapshot();
        });

        it("Checks for name with arguments", () => {
            dis(ac1("a", "k", true));
            expect(dis).toBeCalledWithActionCreator(ac1, "a", "b", true);
            expect(() => expect(dis).toBeCalledWithActionCreator(ac1, "e", "k", false)).toThrowErrorMatchingSnapshot();
            expect(dis).not.toBeCalledWithActionCreator(ac1, "e", "k");

            expect(dis).not.toBeCalledWithActionCreator(ac2, "a", "b", true);
            expect(() => expect(dis).toBeCalledWithActionCreator(ac2, "a", "b", true)).toThrowErrorMatchingSnapshot();
        });

        it("Works for same action creator but different arguments", () => {
            dis(ac1("e", "f", false));
            expect(dis).toBeCalledWithActionCreator(ac1, "a", "b", true);
            expect(dis).toBeCalledWithActionCreator(ac1, "e", "f", false);
        });
    });
});