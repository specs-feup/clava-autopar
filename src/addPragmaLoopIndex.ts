import Clava from "@specs-feup/clava/api/clava/Clava.js";
import CodeInserter from "@specs-feup/clava/api/clava/util/CodeInserter.js";
import Io from "@specs-feup/lara/api/lara/Io.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";
import { Loop, Joinpoint } from "@specs-feup/clava/api/Joinpoints.js";

export function AddPragmaLoopIndex($forLoops : Loop[]) {
    for(var $loop of $forLoops) {
        $loop.insertBefore(`//loopindex ${$loop.id}`);
    }

};