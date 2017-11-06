import { transform } from "@babel/core";
import plugin from "./babel";

it("Doesn't do anything without mock call", () => {
    const source = `
        jest.mock("./e");
        import { a } from "b";
        import e from "./e";
        jest.mock("./b");
    `;

    expect(transform(source, { plugins: [plugin] }).code).toMatchSnapshot();
});

it("Creates mock expressions for imports", () => {
    const source = `
    import a from "./a";
    import { b, c } from "bc";
    import * as m from "module";
    import { default as e } from "../e";
    import { f as k } from "../../f";
    import * as mmm from "mmm";
    import x from "x";

    mockActionCreators(a, b, c, m, e, k, mmm.actions, x.actions);
    `;
    expect(transform(source, { plugins: [plugin] }).code).toMatchSnapshot();
});

it("Creates mock expressions for node require", () => {
    const source = `
    require("nonused");
    const a = require("a");
    const { b, c, d } = require("../bcd");

    mockActionCreators(a.actions, b, c, d);
    `;
    expect(transform(source, { plugins: [plugin] }).code).toMatchSnapshot();
});

it("Skips already mocked modules by jest", () => {
    const source = `
    jest.mock("ac1");
    import * as ac1 from "ac1";
    import { ab } from "ab";
    const anotherAc = require("../another");

    jest.doMock("../another");

    mockActionCreators(ac1.actions, ab, anotherAc.anotherActions);
    `;
    expect(transform(source, { plugins: [plugin] }).code).toMatchSnapshot();
});

it("Works with multiple mock calls", () => {
    const source = `
    import { a } from "a";
    import * as b from "b";

    mockActionCreators(a);
    mockActionCreators(b.actions);
    `;
    expect(transform(source, { plugins: [plugin] }).code).toMatchSnapshot();
});

it("Don't create mocks for already processed modules", () => {
    const source = `
    import { a } from "a";
    import * as b from "b";
    import c from "c";

    mockActionCreators(a, b.actions, a, b.actions);
    mockActionCreators(c, a);
    `;
    expect(transform(source, { plugins: [plugin] }).code).toMatchSnapshot();
});

it("Works when mockActionCreators is being renamed in import", () => {
    const source = `
    import { mockActionCreators as mac } from "a";
    import * as b from "b";
    import c from "c";

    mac(b.actions, c);
    `;
    expect(transform(source, { plugins: [plugin] }).code).toMatchSnapshot();
});

it("Inserts mocks after use strict", () => {
    const source = `
    "use strict";

    import { a } from "a";
    import * as b from "b";

    mockActionCreators(a, b);
    `;
    expect(transform(source, { plugins: [plugin] }).code).toMatchSnapshot();
});