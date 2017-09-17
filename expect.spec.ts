import { mockActionCreators } from "./";
import "./expect";

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
        expect(dis).toBeCalledWithActionCreator(ac1, "a", "b", true);
        expect(() => expect(dis).toBeCalledWithActionCreator(ac1, "e", "k", false)).toThrowErrorMatchingSnapshot();
        expect(dis).not.toBeCalledWithActionCreator(ac1, "e", "k");

        expect(dis).not.toBeCalledWithActionCreator(ac2, "a", "b", true);
        expect(() => expect(dis).toBeCalledWithActionCreator(ac2, "a", "b", true)).toThrowErrorMatchingSnapshot();
    });
})
