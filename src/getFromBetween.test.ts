import GetFromBetween from "./getFromBetween.js";

describe("GetFromBetween", () => {
    test("extracts text between delimiters", () => {
        const parser = new GetFromBetween();

        expect(parser.get("before[start]after", "[", "]")).toEqual(["start"]);
    });

    test("extracts repeated delimited values in source order", () => {
        const parser = new GetFromBetween();

        expect(parser.get("a[first] b[second] c[third]", "[", "]")).toEqual([
            "first",
            "second",
            "third",
        ]);
    });

    test("returns an empty result when either delimiter is missing", () => {
        const parser = new GetFromBetween();

        expect(parser.get("no delimiters", "[", "]")).toEqual([]);
        expect(parser.get("only [an opening delimiter", "[", "]")).toEqual([]);
    });

    test("clears results between calls", () => {
        const parser = new GetFromBetween();

        parser.get("[old]", "[", "]");

        expect(parser.get("[new]", "[", "]")).toEqual(["new"]);
    });
});
