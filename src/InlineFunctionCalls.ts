/**************************************************************
* 
*                       InlineFunctionCalls
* 
**************************************************************/

import Query from "@specs-feup/lara/api/weaver/Query.js";
import { Call, FileJp, FunctionJp, Loop } from "@specs-feup/clava/api/Joinpoints.js";

interface FunctionData{
    innerCallNumber: number;
    CallingFunc : string[];
}

const func_name: Record<string, FunctionData> = {};

export default function InlineFunctionCalls() {

    for (const $function of Query.search(FileJp).search(FunctionJp)) {
        const innerCalls = $function.getDescendants("call") as Call[];
        if (func_name[$function.name] === undefined) {
            func_name[$function.name] = {
                innerCallNumber: innerCalls.length,
                CallingFunc: [],
            };
        }
    }

    const sorted : [string, number][] = [];
    for (const key in func_name) {
        sorted.push([key, func_name[key].innerCallNumber]);
    }

    sorted.sort((obj1, obj2) => obj1[1] - obj2[1]);

    for (const i of sorted) {
        inlineFunction(i[0]);
    }
}

/**************************************************************
* 
*                       inlineFunction
* 
**************************************************************/

export function inlineFunction(funcname: string) {
    for (const chain of Query.search(FileJp)
        .search(FunctionJp)
        .search(Loop)
        .search(Call)
        .chain()) {
        const $call = chain["call"] as Call;
        const $loop = chain["loop"] as Loop;
        if ($call.name === funcname) {
            const ancestorLoop = $call.getAncestor("loop") as Loop;
            if (
                ancestorLoop === undefined ||
                ancestorLoop.rank.join("_") === $loop.rank.join("_")
            ) {
                $call.inline();
            }
        }
    }
}
