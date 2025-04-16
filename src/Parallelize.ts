import InlineFunctionCalls from "./InlineFunctionCalls.js";
import RemoveNakedloops from "./RemoveNakedloops.js";
import NormalizedBinaryOp from "./NormalizedBinaryOp.js";
import ParallelizeLoop from "./ParallelizeLoop.js";
import AddPragmaLoopIndex from "./AddPragmaLoopIndex.js";
import RunInlineFunctionCalls from "./RunInlineFunctionCalls.js";
import LoopInductionVariables from "./LoopInductionVariables.js";
import CheckForSafeFunctionCall from "./CheckForSafeFunctionCall.js";
import AutoParStats from "./AutoParStats.js";

import Clava from "@specs-feup/clava/api/clava/Clava.js";
import CodeInserter from "@specs-feup/clava/api/clava/util/CodeInserter.js";
import Io from "@specs-feup/lara/api/lara/Io.js";

import Query from "@specs-feup/lara/api/weaver/Query.js";
import { FileJp, Loop, Omp, Pragma } from "@specs-feup/clava/api/Joinpoints.js";
import GetLoopIndex from "./GetLoopIndex.js";
import { JavaClasses } from "@specs-feup/lara/api/lara/util/JavaTypes.js";

/**
 * Utility methods for parallelization.
 *
 * @class
 */
interface OmpPragma {
    pragmaCode: string;
}

export const OmpPragmas: Record<string, OmpPragma> = {};

export default class Parallelize {
    static forLoops($loops: Loop[]) {
        let autoparResult = Parallelize.getForLoopsPragmas($loops, true);

        console.log("Parallelization finished");
    }

    static forLoopsAsText(
        $loops: Loop[],
        outputFolder: JavaClasses.File = Io.getPath("./")
    ) {
        let autoparResult = Parallelize.getForLoopsPragmas($loops, true);
        let parallelLoops = autoparResult["parallelLoops"];

        let codeInserter = new CodeInserter();
        let filesWithPragmas: FileJp[] = [];

        // Add pragmas to loops
        for (const $loop of $loops) {
            let ompPragma = parallelLoops[$loop.astId];
            if (ompPragma === undefined) {
                //console.log("Could not parallelize loop@"+$loop.location+":\n -> " + unparallelizableLoops[$loop.astId]);
                continue;
            }

            let $file = $loop.getAncestor("file") as FileJp;
            if ($file === undefined) {
                console.log(
                    "Could not find a file associated with loop@" +
                        $loop.location
                );
                continue;
            }

            codeInserter.add($file, $loop.line, ompPragma);

            // Add file
            filesWithPragmas.push($file);
        }

        // Add includes to files that have pragmas
        for (const $fileJp of filesWithPragmas) {
            if ($fileJp === undefined) {
                throw new Error();
            }
            codeInserter.add($fileJp, 1, "#include <omp.h>");
        }

        codeInserter.write(outputFolder.getAbsolutePath());

        console.log("Parallelization finished");
    }

    /**
     *
     * @param {$loop[]} [$loops=<All program loops>] - Array of loops to parallelize.
     * @param {boolean} insertPragma - If true, inserts the found pragmas in the code.
     * @param {boolean} useLoopId - If true, the returning map uses $loop.id instead of $loop.astId as keys.
     *
     * @return {Object[parallelLoops, unparallelizableLoops]} an object with the pragmas of the parallelized loops, and the error messages of the loops that could not be parallelized.
     */
    static getForLoopsPragmas(
        $loops: Loop[] = Clava.getProgram().getDescendants("loop") as Loop[],
        insertPragma: boolean = false,
        useLoopId: boolean = false
    ) {
        // Reset stats
        //Parallelize.resetStats();

        // Filter any loop that is not a for loop
        let $forLoops: Loop[] = [];
        for (const $loop of $loops) {
            if ($loop.kind !== "for") {
                continue;
            }

            $forLoops.push($loop);
        }

        // Save the current AST, before applying modifications that help analysis
        Clava.pushAst();

        // Mark all for loops with pragmas
        for (const $originalLoop of $forLoops) {
            if ($originalLoop.kind !== "for") {
                continue;
            }

            let $loop = Clava.findJp($originalLoop);

            $loop.insertBefore("#pragma parallelize_id " + $originalLoop.astId);
        }

        // Transformations to help analysis
        RemoveNakedloops();
        AddPragmaLoopIndex();
        RunInlineFunctionCalls();

        // Rebuild tree
        Clava.rebuild();

        LoopInductionVariables();
        CheckForSafeFunctionCall();
        RemoveNakedloops();
        NormalizedBinaryOp();

        // Rebuild tree
        Clava.rebuild();

        // Write stats before attempting parallelization
        AutoParStats.save();

        console.log("Parallelizing " + $forLoops.length + " for loops...");

        // Find all loops marked for parallelization
        let parallelLoops: Record<string, string> = {};
        let unparallelizableLoops: Record<string, string> = {};

        let $pragmas = Clava.getProgram().getDescendants("pragma") as Pragma[];
        for (const $pragma of $pragmas) {
            if ($pragma.name !== "parallelize_id") {
                continue;
            }

            const parallelization = ParallelizeLoop($pragma.target as Loop);
        }

        // Revert AST changes
        Clava.popAst();

        let loopIds: string[] = [];
        for (const $loop of $loops) {
            loopIds.push($loop.id);
        }

        for (const $loop of Query.search(Loop).get()) {
            const loopindex = GetLoopIndex($loop);
            if (
                OmpPragmas[loopindex] !== undefined &&
                loopIds.includes($loop.id)
            ) {
                if (insertPragma) {
                    $loop.insert("before", OmpPragmas[loopindex].pragmaCode);
                }

                //	parallelLoops[$pragma.content] = OmpPragmas[loopindex].pragmaCode;
                let pragmaCode = OmpPragmas[loopindex].pragmaCode;
                let loopId = useLoopId ? $loop.id : $loop.astId;
                if (pragmaCode.startsWith("#pragma")) {
                    parallelLoops[loopId] = pragmaCode;
                } else {
                    unparallelizableLoops[loopId] = pragmaCode;
                }
            }
        }

        let result = {
            parallelLoops,
            unparallelizableLoops,
        };

        return result;
    }

    /**
     * Comments OpenMP pragmas that are nested inside other OpenMP pragmas.
     *
     * @return {String} the loop ids of loops whose OpenMP pragmas where commented.
     */
    static removeNestedPragmas(): string[] {
        let pragmasToComment: Omp[] = [];
        let commentedLoopIds: string[] = [];

        for (const $omp of Query.search(Omp)) {
            if (Parallelize.isNestedOpenMP($omp)) {
                pragmasToComment.push($omp);
                commentedLoopIds.push(($omp.target as Loop).id);
            }
        }

        for (const $pragma of pragmasToComment) {
            $pragma.replaceWith("// " + $pragma.code);
        }

        return commentedLoopIds;
    }

    static isNestedOpenMP($omp: Omp): boolean {
        // Check if OpenMP pragma is inside a loop with another OpenMP pragma
        const $loop = $omp.target as Loop;

        let $ancestor = $loop.parent;
        while ($ancestor !== undefined) {
            if ($ancestor instanceof Loop) {
                for (const $pragma of $ancestor.pragmas) {
                    if ($pragma instanceof Omp) {
                        return true;
                    }
                }
            }

            $ancestor = $ancestor.parent;
        }

        return false;
    }
}
