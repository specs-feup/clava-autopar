import Clava from "@specs-feup/clava/api/clava/Clava.js";
import CodeInserter from "@specs-feup/clava/api/clava/util/CodeInserter.js";
import Io from "@specs-feup/lara/api/lara/Io.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";
import { safefunctionCallslist } from "./SafeFunctionCalls.js";
import {
    Loop,
    Joinpoint,
    If,
    ArrayAccess,
    Continue,
    MemberAccess,
    Varref,
    Call,
    FileJp,
    FunctionJp,
    Body,
} from "@specs-feup/clava/api/Joinpoints.js";

/**************************************************************
 *
 *                       checkForSafeFunctionCall
 *
 **************************************************************/
export function CheckForSafeFunctionCall(
    $function: Function,
    $arrayAccess: ArrayAccess,
    $memberAccess: MemberAccess,
    $varref: Varref,
    $file: FileJp
) {
    const new_safefunctionCallslist: string[] = [];
    for (const $function of Query.search(FileJp).search(FunctionJp)) {
        if ($function.params.length > 0) {
            if (new_safefunctionCallslist.indexOf($function.name) == -1)
                new_safefunctionCallslist.push($function.name);
        }
    }
    for (const chain of Query.search(FileJp)
        .search(FunctionJp)
        .search(Call).chain()) {
        const $function = chain["function"] as FunctionJp;
        if (new_safefunctionCallslist.indexOf($function.name) != -1) {
            new_safefunctionCallslist.splice(
                new_safefunctionCallslist.indexOf($function.name),
                1
            );
        }
    }

    for (const $function of Query.search(FileJp)
        .search(FunctionJp)
        .search(Body)
        .search(ArrayAccess)) {
        if (new_safefunctionCallslist.indexOf($function.name) != -1) {
            if ($arrayAccess.use.indexOf("write") == -1) {
                continue;
            }

            var currentRegion = (
                $arrayAccess.arrayVar.getDescendantsAndSelf(
                    "varref"
                )[0] as Varref
            ).vardecl.currentRegion;
            if (
                (currentRegion != undefined &&
                    currentRegion.joinPointType == "file") ||
                (
                    $arrayAccess.arrayVar.getDescendantsAndSelf(
                        "varref"
                    )[0] as Varref
                ).vardecl.isParam
            ) {
                new_safefunctionCallslist.splice(
                    new_safefunctionCallslist.indexOf($function.name),
                    1
                );
            }
        }
    }

    for (const $function of Query.search(FileJp)
        .search(FunctionJp)
        .search(Body)
        .search(MemberAccess)) {
        if (new_safefunctionCallslist.indexOf($function.name) != -1) {
            if ($memberAccess.use.indexOf("write") == -1) {
                continue;
            }

            var currentRegion = (
                $memberAccess.getDescendantsAndSelf("varref")[0] as Varref
            ).vardecl.currentRegion;
            if (
                currentRegion !== undefined &&
                currentRegion.joinPointType === "file"
            ) {
                new_safefunctionCallslist.splice(
                    new_safefunctionCallslist.indexOf($function.name),
                    1
                );
            }
        }
    }

    for (const $function of Query.search(FileJp)
        .search(FunctionJp)
        .search(Body)
        .search(Varref)) {
        if (new_safefunctionCallslist.indexOf($function.name) != -1) {
            if ($varref.useExpr.use.indexOf("write") == -1) {
                continue;
            }

            var currentRegion = $varref.vardecl.currentRegion;
            if (
                currentRegion != undefined &&
                currentRegion.joinPointType == "file"
            ) {
                new_safefunctionCallslist.splice(
                    new_safefunctionCallslist.indexOf($function.name),
                    1
                );
            }
        }
    }

    for (const $function of Query.search(FileJp)) {
        $file.insertBegin(
            "//new_safefunctionCallslist : " +
                new_safefunctionCallslist.join(" , ")
        );
    }
    //erro aqui por ser const
    if (new_safefunctionCallslist.length > 0)
        safefunctionCallslist.push(...new_safefunctionCallslist);
}
