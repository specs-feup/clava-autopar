import Query from "@specs-feup/lara/api/weaver/Query.js";
import {
    ArrayAccess,
    Call,
    Expression,
    FunctionJp,
    If,
    Loop,
    Param,
    Statement,
    Varref,
} from "@specs-feup/clava/api/Joinpoints.js";
import { LoopOmpAttributes } from "./checkForOpenMPCanonicalForm.js";
import get_varTypeAccess from "./get_varTypeAccess.js";
import Add_msgError from "./Add_msgError.js";
import SearchStruct from "./SearchStruct.js";
import Strings from "@specs-feup/lara/api/lara/Strings.js";
import { orderedVarrefs3 } from "./orderedVarrefs3.js";
import GetLoopIndex from "./GetLoopIndex.js";
import { safefunctionCallslist } from "./SafeFunctionCalls.js";

/**************************************************************
 *
 *                       SetVariableAccess
 *
 **************************************************************/
export interface VarUsage {
    line: number;
    use: string;
    code: string;
    isInsideLoopHeader: boolean;
    parentlooprank: number[];
    subscript?: Expression[];
    IsdependentCurrentloop: boolean;
    IsdependentInnerloop: boolean;
    IsdependentOuterloop: boolean;
    subscriptcurrentloop?: string;
}

export interface VarAccess {
    name: string | undefined;
    varTypeAccess: string | undefined;
    isInsideLoopHeader: boolean;
    declpos: string | null;
    usedInClause: boolean;
    use: string;
    sendtoPetit: boolean;
    useT: string;
    nextUse: string | null;
    varUsage: VarUsage[];
    ArraySize: string | null;
    hasDescendantOfArrayAccess: boolean;
}

export default function SetVariableAccess($ForStmt: Loop) {
    const loopindex = GetLoopIndex($ForStmt);
    if (LoopOmpAttributes[loopindex].msgError?.length !== 0) return;

    let innerloopsControlVarname: string[] = [];
    const loopControlVarname = LoopOmpAttributes[loopindex].loopControlVarname;
    const tmp = LoopOmpAttributes[loopindex].innerloopsControlVarname;
    if (tmp) {
        innerloopsControlVarname = innerloopsControlVarname.concat(tmp);
    }

    LoopOmpAttributes[loopindex].varAccess = [];

    const $forFunction = $ForStmt.getAncestor("FunctionDecl");
    if ($forFunction === undefined) {
        let $forRoot = $ForStmt.parent;
        while ($forRoot.parent !== undefined) {
            $forRoot = $forRoot.parent;
        }
    }

    const functionvarrefset = orderedVarrefs3(
        $ForStmt.getAncestor("FunctionDecl")
    );
    const loopvarrefset = orderedVarrefs3($ForStmt);

    const noVarrefVariables = [];

    for (let index = 0; index < loopvarrefset.length; index++) {
        const $varref = loopvarrefset[index];

        const o = get_varTypeAccess($varref);
        const varTypeAccess = o.varTypeAccess;

        if (varTypeAccess === null) {
            continue;
        }

        const vardecl = o.vardecl;
        const varUse = o.varUse;
        let declpos = null;
        const varName = o.varName;

        if (
            varTypeAccess !== "varref" &&
            noVarrefVariables.indexOf(varName) === -1
        )
            noVarrefVariables.push(varName);

        const useExpr =
            varUse === "read" ? "R" : varUse === "write" ? "W" : "RW";

        if (vardecl != null) {
            let vardeclRegion = "";
            if (vardecl.currentRegion !== undefined) {
                vardeclRegion = vardecl.currentRegion.joinPointType;
            }

            if ($ForStmt.contains(vardecl) === true) declpos = "inside";
            else if (vardecl instanceof Param) declpos = "param";
            else if (vardeclRegion === "file") declpos = "global";
            else if (vardeclRegion === "function") declpos = "outside";
            else if (vardeclRegion === "loop") declpos = "outside";
            else if (vardeclRegion === "scope") declpos = "inside";
            else if (
                (vardecl.getAncestor("FunctionDecl") as FunctionJp).name ===
                ($ForStmt.getAncestor("FunctionDecl") as FunctionJp).name
            )
                declpos = "outside";
            else {
                Add_msgError(
                    LoopOmpAttributes,
                    $ForStmt,
                    "declpos for Variable " +
                        $varref.name +
                        " can not be specified " +
                        "\t vardeclRegion : " +
                        vardeclRegion +
                        "\t $ForStmt.contains(vardecl) : " +
                        $ForStmt.contains(vardecl) +
                        "\t vardecl : " +
                        vardecl.code +
                        " #" +
                        vardecl.line
                );
                return;
            }
        }

        if (
            varTypeAccess === "varref" &&
            (innerloopsControlVarname.indexOf($varref.name) !== -1 ||
                loopControlVarname === $varref.name) // is loop control variable
        )
            continue;
        if ($varref.isFunctionArgument === true) {
            const callJP = $varref.getAncestor("call") as Call;
            if (safefunctionCallslist.indexOf(callJP.name) === -1) {
                Add_msgError(
                    LoopOmpAttributes,
                    $ForStmt,
                    "Variable Access for " +
                        $varref.name +
                        " Can not be traced inside of function " +
                        callJP.name +
                        " called at line #" +
                        callJP.line
                );
                return;
            }
        }

        let hasDescendantOfArrayAccess = false;
        if ($varref.getDescendantsAndSelf("arrayAccess").length > 0)
            hasDescendantOfArrayAccess = true;

        let arraysizeStr = null;

        const varUsage: VarUsage = {
            line: $varref.line,
            use: useExpr,
            code: $varref.code,
            isInsideLoopHeader: $varref.isInsideLoopHeader,
            parentlooprank: ($varref.getAncestor("ForStmt") as Loop).rank,
            IsdependentCurrentloop: false,
            IsdependentInnerloop: false,
            IsdependentOuterloop: false,
        };

        if (
            varTypeAccess === "memberArrayAccess" ||
            varTypeAccess === "arrayAccess"
        ) {
            varUsage.subscript = ($varref as unknown as ArrayAccess).subscript;
            if (vardecl != null) {
                arraysizeStr = vardecl.code;
                arraysizeStr = arraysizeStr.slice(
                    arraysizeStr.indexOf("["),
                    arraysizeStr.lastIndexOf("]") + 1
                );
                if (arraysizeStr.length === 0)
                    // parameter pass as : int *array
                    arraysizeStr = null;
            }
        }

        if (hasDescendantOfArrayAccess === true) {
            if (($varref as any).subscript === undefined) {
                Add_msgError(
                    LoopOmpAttributes,
                    $ForStmt,
                    " NO  subscript for Array Access " + $varref.code
                );
                return;
            }
            if (loopControlVarname) {
                varUsage.subscriptcurrentloop = retsubscriptcurrentloop(
                    $varref as unknown as ArrayAccess,
                    loopControlVarname
                );
            } else {
                throw new Error("loopControlVarname undefined");
            }

            let subscriptVarNamelist: string[] = [];
            for (const arrayAccessobj of $varref.getDescendantsAndSelf(
                "arrayAccess"
            )) {
                subscriptVarNamelist = retsubscriptVars(
                    arrayAccessobj as ArrayAccess,
                    subscriptVarNamelist
                );
            }

            if (
                loopControlVarname &&
                subscriptVarNamelist.indexOf(loopControlVarname) !== -1
            )
                varUsage.IsdependentCurrentloop = true;

            for (const innerloopsVarname of innerloopsControlVarname)
                if (subscriptVarNamelist.indexOf(innerloopsVarname) !== -1) {
                    varUsage.IsdependentInnerloop = true;
                    break;
                }

            for (const subscriptVarName of subscriptVarNamelist)
                if (
                    subscriptVarName !== loopControlVarname &&
                    innerloopsControlVarname.indexOf(subscriptVarName) === -1
                ) {
                    const varObj = SearchStruct(
                        LoopOmpAttributes[loopindex].varAccess,
                        { varTypeAccess: "varref", name: subscriptVarName }
                    );

                    if (
                        varObj.length !== 0 &&
                        varObj[0].use.indexOf("W") !== -1
                    )
                        break;
                    varUsage.IsdependentOuterloop = true;
                    break;
                }

            let strdep = "";
            strdep =
                strdep +
                (varUsage.IsdependentCurrentloop === true
                    ? " dependentCurrentloop\t "
                    : "\t ");
            strdep =
                strdep +
                (varUsage.IsdependentInnerloop === true
                    ? " dependentInnerloop\t "
                    : "\t ");
            strdep =
                strdep +
                (varUsage.IsdependentOuterloop === true
                    ? " IsdependentOuterloop\t "
                    : "\t ");
        }

        const varObj = SearchStruct(LoopOmpAttributes[loopindex].varAccess, {
            varTypeAccess: varTypeAccess,
            name: varName,
        });

        let varNextUse;
        if (varObj.length === 0) {
            if (varTypeAccess && varName) {
                if (LoopOmpAttributes[loopindex].end === undefined) {
                    throw new Error(
                        "LoopOmpAttributes[loopindex].end is undefined"
                    );
                }
                const end = LoopOmpAttributes[loopindex]
                    .end as unknown as number;
                varNextUse = FindVariableNextUse(
                    functionvarrefset,
                    end,
                    varTypeAccess,
                    varName
                );
            } else {
                throw new Error("LoopOmpAttributes[loopindex] is undefined");
            }

            LoopOmpAttributes[loopindex].varAccess?.push({
                name: varName,
                varTypeAccess: varTypeAccess,
                isInsideLoopHeader: $varref.isInsideLoopHeader,
                declpos: declpos,
                usedInClause: false,
                use: useExpr,
                sendtoPetit: false,
                useT: useExpr,
                nextUse: varNextUse,
                varUsage: [varUsage],
                ArraySize: arraysizeStr,
                hasDescendantOfArrayAccess: hasDescendantOfArrayAccess,
            });
        } else {
            for (const element of useExpr)
                if (varObj[0].use[varObj[0].use.length - 1] != element) {
                    varObj[0].use += element;
                }

            varObj[0].use = Strings.replacer(varObj[0].use, "WRW", "W");
            varObj[0].varUsage.push(varUsage);
            varObj[0].useT += useExpr;
        }
    }

    // for removing array access with similar subscript for current loop
    const candidateArraylist = SearchStruct(
        LoopOmpAttributes[loopindex].varAccess,
        { usedInClause: false, hasDescendantOfArrayAccess: true }
    );

    for (let i = 0; i < candidateArraylist.length; i++) {
        const varObj = candidateArraylist[i];

        if (varObj.use.indexOf("W") !== -1) {
            const tmpstr = varObj.varUsage[0].subscriptcurrentloop;
            for (const element of varObj.varUsage) {
                if (
                    element.subscriptcurrentloop !== tmpstr ||
                    element.subscriptcurrentloop === ""
                ) {
                    varObj.sendtoPetit = true;
                    break;
                }
            }
        } else varObj.sendtoPetit = false;
    }

    for (
        let index = 0;
        index < LoopOmpAttributes[loopindex].varAccess.length;
        index++
    ) {
        const varObj = LoopOmpAttributes[loopindex].varAccess[index];
        if (
            varObj.varTypeAccess === "varref" &&
            noVarrefVariables.indexOf(varObj.name) !== -1
        ) {
            LoopOmpAttributes[loopindex].varAccess.splice(index, 1);
            index--;
        }
    }

    const varreflist = SearchStruct(LoopOmpAttributes[loopindex].varAccess, {
        varTypeAccess: "varref",
    });
    const varreflistName = [];
    for (const element of varreflist) {
        varreflistName.push(element.name);
    }

    for (const $varref of Query.searchFrom($ForStmt.body, If).search(Varref, {
        useExpr: (useExpr) => useExpr.use === "write",
    })) {
        const index = varreflistName.indexOf($varref.name);
        if (
            index !== -1 &&
            varreflist[index].declpos !== "inside" &&
            varreflist[index].useT === "W" &&
            varreflist[index].nextUse === "R"
        ) {
            Add_msgError(
                LoopOmpAttributes,
                $ForStmt,
                " Variable Access " +
                    $varref.name +
                    " is changed inside  of ifstmt"
            );
            return;
        }
    }

    LoopOmpAttributes[loopindex].privateVars = [];
    LoopOmpAttributes[loopindex].firstprivateVars = [];
    LoopOmpAttributes[loopindex].lastprivateVars = [];
    LoopOmpAttributes[loopindex].Reduction = [];
}

/**************************************************************
 *
 *                       FindVariableNextUse
 *
 **************************************************************/

function FindVariableNextUse(
    functionvarrefset: Varref[],
    loopEndline: number,
    varTypeAccess: string,
    varName: string
) {
    let varNextUse = null;

    for (const element of functionvarrefset)
        if (element.line > loopEndline) {
            const $varobj = element;
            const o = get_varTypeAccess($varobj);
            if (o.varTypeAccess === varTypeAccess && o.varName === varName) {
                varNextUse =
                    o.varUse == "read" ? "R" : o.varUse == "write" ? "W" : "RW";
                break;
            }
        }

    return varNextUse;
}

function retsubscriptVars($stmt: ArrayAccess, varNamelist: string[]) {
    for (const $subscript of $stmt.subscript) {
        for (const $varref of Query.searchFromInclusive($subscript, Varref)) {
            if (varNamelist.indexOf($varref.name) === -1) {
                varNamelist.push($varref.name);
            }
        }
    }

    return varNamelist;
}

function retsubscriptcurrentloop(
    $varref: ArrayAccess,
    loopControlVarname: string
) {
    let subscriptstr = "";

    for (const $subscript of $varref.subscript) {
        for (const $varref of $subscript.getDescendantsAndSelf(
            "varref"
        ) as Varref[])
            if ($varref.name === loopControlVarname) {
                subscriptstr += "[" + $subscript.code + "]";
                break;
            }
    }

    return subscriptstr;
}
