import { registerSourceCode } from "@specs-feup/lara/jest/jestHelpers.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";
import { Loop } from "@specs-feup/clava/api/Joinpoints.js";
import Io from "@specs-feup/lara/api/lara/Io.js";

import AddOpenMPDirectivesForLoop from "./AddOpenMPDirectivesForLoop.js";
import AutoparJavaTypes from "./AutoparJavaTypes.js";
import checkForOpenMPCanonicalForm, {
    LoopOmpAttributes,
} from "./checkForOpenMPCanonicalForm.js";
import GetLoopIndex from "./GetLoopIndex.js";
import ParallelizeLoop from "./ParallelizeLoop.js";

const independentLoop = `
void scale(int *output, const int *input) {
    for (int i = 0; i < 100; i++) {
        output[i] = input[i] * 2;
    }
}
`;

describe("ParallelizeLoop Clava integration", () => {
    registerSourceCode(independentLoop);

    beforeEach(() => {
        for (const loopIndex of Object.keys(LoopOmpAttributes)) {
            delete LoopOmpAttributes[loopIndex];
        }
    });

    test("uses Clava to apply an OpenMP pragma to a parsed loop", () => {
        const loop = Query.search(Loop, { kind: "for" }).getFirst();

        expect(loop).toBeDefined();

        checkForOpenMPCanonicalForm(loop!);

        const attributes = LoopOmpAttributes[GetLoopIndex(loop!)];
        attributes.privateVars = ["i"];
        attributes.firstprivateVars = [];
        attributes.lastprivateVars = [];
        attributes.Reduction = [];
        attributes.DepPetitFileName = null;

        AddOpenMPDirectivesForLoop(loop!);

        const pragma = loop!.pragmas.find((candidate) =>
            candidate.code.includes("omp parallel for")
        );

        expect(pragma).toBeDefined();
        expect(pragma!.code).toContain("#pragma omp parallel for");
        expect(pragma!.code).toContain("default(shared)");
        expect(pragma!.code).toContain("private(i)");
    });

    test("runs the parallelization pipeline with an independent dependency result", () => {
        const loop = Query.search(Loop, { kind: "for" }).getFirst();

        expect(loop).toBeDefined();

        const petit = AutoparJavaTypes.ClavaPetit;
        const executePetit = petit.execute;
        petit.execute = (args: { toArray(): unknown[] }) => {
            const outputArgument = args
                .toArray()
                .map(String)
                .find((argument) => argument.startsWith("-R"));

            expect(outputArgument).toBeDefined();
            Io.writeFile(outputArgument!.substring(2), "");

            return "";
        };

        try {
            ParallelizeLoop(loop!);
        } finally {
            petit.execute = executePetit;
        }

        const pragma = loop!.pragmas.find((candidate) =>
            candidate.code.includes("omp parallel for")
        );

        expect(pragma).toBeDefined();
        expect(pragma!.code).toContain("default(shared)");
    });

    const linuxTest = process.platform === "linux" ? test : test.skip;

    linuxTest("parallelizes an independent loop with Petit", () => {
        const loop = Query.search(Loop, { kind: "for" }).getFirst();

        expect(loop).toBeDefined();

        ParallelizeLoop(loop!);

        const pragma = loop!.pragmas.find((candidate) =>
            candidate.code.includes("omp parallel for")
        );

        expect(pragma).toBeDefined();
        expect(pragma!.code).toContain("#pragma omp parallel for");
        expect(pragma!.code).toContain("default(shared)");
    });
});
