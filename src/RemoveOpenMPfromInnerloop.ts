/**************************************************************
* 
*               RemoveOpenMPfromInnerloop
* 
**************************************************************/

import Query from "@specs-feup/lara/api/weaver/Query.js";
import { Body, Call, FileJp, FunctionJp, Loop, Omp } from "@specs-feup/clava/api/Joinpoints.js";


export default function RemoveOpenMPfromInnerloop() {

    for (const $function of Query.search(FileJp).search(FunctionJp)){
        for (const $omp of Query.searchFrom($function.body, Omp, { kind: "parallel for" })){
            if (typeof $omp.target !== 'undefined')
                RemoveSubOmpParallel($omp.target as Loop);
        }
    }


    const exclude_func_from_Omp: string[] = [];

    for (const $function of Query.search(FileJp).search(FunctionJp)){
        for (const $omp of Query.searchFrom($function.body, Omp, { kind: "parallel for" })){
            if (typeof $omp.target !== 'undefined') {
                const func_names = find_func_call($omp.target as Loop);
                for (const func_name of func_names)
                    if (exclude_func_from_Omp.indexOf(func_name) === -1)
                        exclude_func_from_Omp.push(func_name);
            }
        }
    }
    for (const $function of Query.search(FileJp).search(FunctionJp)){
        for (const $omp of Query.searchFrom($function.body, Omp, { kind: "parallel for" })){
            const func_name = ($omp.getAncestor('function') as FunctionJp).name;
            if (exclude_func_from_Omp.indexOf(func_name) !== -1)
                $omp.insert("replace", '// #pragma omp ' + $omp.content + '   remove due to be part of parallel section for function call');
        }
    }
}
/**************************************************************
* 
*                     RemoveSubOmpParallel
* 
**************************************************************/
function RemoveSubOmpParallel($loop: Loop) {
    for (const $omp of Query.searchFrom($loop.body, Omp, { kind: "parallel for" })) {
        $omp.insert("replace", '// #pragma omp ' + $omp.content);
    }
}

function find_func_call($loop: Loop): Array<string> {
    const func_names: string[] = [];

    for (const $call of Query.searchFrom($loop.body, Call, { astName: "CallExpr" })) {
        func_names.push($call.name);
    }

    return func_names;
}