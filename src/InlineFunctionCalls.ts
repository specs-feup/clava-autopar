/**************************************************************
* 
*                       InlineFunctionCalls
* 
**************************************************************/

import Query from "@specs-feup/lara/api/weaver/Query.js";
import { Call, FileJp, FunctionJp, Loop, Omp } from "@specs-feup/clava/api/Joinpoints.js";

interface FunctionData{
    innerCallNumber: number;
    CallingFunc : string[];
}

const func_name: Record<string, FunctionData> = {};

export default function InlineFunctionCalls() {

    for (const $function of Query.search(FileJp).search(FunctionJp)) {
        if (func_name[$function.name] === undefined) {
            func_name[$function.name] = {
                innerCallNumber: 0,
                CallingFunc: []
            };
            func_name[$function.name].innerCallNumber = 0;
        }
    }

    for (const $function of Query.search(FileJp).search(FunctionJp)) {
        const innerCalls = $function.getDescendants('call') as Call[];
        func_name[$function.name].innerCallNumber = innerCalls.length;
    }

    let sorted : [string, number][] = [];
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
    for (const $call of Query.search(FileJp).search(Call)) {
        if ($call.name === funcname) {
            const loop = $call.getAncestor('loop') as Loop;
            if (loop === undefined || loop.rank.join('_') === ($call.getAncestor('loop') as Loop).rank.join('_')) {
                $call.inline();
            }
        }
    }
}
