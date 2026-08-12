import {
    allReplace,
    getBetweenBrackets,
    normalizeVarName,
    normalizeVarName2,
} from "./allReplace.js";

describe("allReplace", () => {
    test("replaces every occurrence of each configured pattern", () => {
        expect(allReplace("alpha + alpha - beta", { alpha: "x", beta: "y" })).toBe(
            "x + x - y"
        );
    });

    test("applies replacements in object insertion order", () => {
        expect(allReplace("abc", { ab: "x", x: "y" })).toBe("yc");
    });
});

describe("array subscript helpers", () => {
    test("finds every bracketed expression", () => {
        const matches = getBetweenBrackets("matrix[row + 1][column]");

        expect(matches.map((match) => match[0])).toEqual(["[row + 1]", "[column]"]);
        expect(matches.map((match) => match[1])).toEqual(["row + 1", "column"]);
    });

    test("returns no matches when the input has no brackets", () => {
        expect(getBetweenBrackets("scalar")).toEqual([]);
    });

    test("normalizes all dimensions with either removal or placeholders", () => {
        expect(normalizeVarName("matrix[row][column]")).toBe("matrix");
        expect(normalizeVarName2("matrix[row][column]")).toBe("matrix--");
    });
});
