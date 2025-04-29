/**************************************************************
 *
 *                       BuildPetitFileInput
 *
 **************************************************************/
import get_varTypeAccess from "./get_varTypeAccess.js";
import {
    FunctionJp,
    Loop,
    Joinpoint,
    BinaryOp,
    Vardecl,
    Varref,
    Op,
} from "@specs-feup/clava/api/Joinpoints.js";
import GetLoopIndex from "./GetLoopIndex.js";
import {
    LoopOmpAttribute,
    LoopOmpAttributes,
} from "./checkForOpenMPCanonicalForm.js";
import SearchStruct from "./SearchStruct.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";
import { VarAccess } from "./SetVariableAccess.js";

export default function BuildPetitFileInput($ForStmt: Loop) {
    let replace_vars: string[] = [];
    let loopindex: string = GetLoopIndex($ForStmt);

    if (typeof LoopOmpAttributes[loopindex] === "undefined") return;

    LoopOmpAttributes[loopindex].ForStmtToPetit = [];
    LoopOmpAttributes[loopindex].petit_variables = [];
    LoopOmpAttributes[loopindex].petit_arrays = {};
    LoopOmpAttributes[loopindex].petit_loop_indices = [];

    LoopOmpAttributes[loopindex].petit_variables.push("petit_tmp");

    let varreflist: VarAccess[] = SearchStruct(
        LoopOmpAttributes[loopindex].varAccess ?? [],
        { varTypeAccess: "varref" }
    );
    for (let i = 0; i < varreflist.length; i++) {
        const name = varreflist[i].name;
        if (typeof name === "string") {
            LoopOmpAttributes[loopindex].petit_variables.push(name);
            if (name[0] === "_") {
                replace_vars.push(name);
            }
        }
    }

    let loopsControlVarname = [];
    loopsControlVarname.push(LoopOmpAttributes[loopindex].loopControlVarname);
    if (LoopOmpAttributes[loopindex].innerloopsControlVarname !== undefined)
        loopsControlVarname = loopsControlVarname.concat(
            LoopOmpAttributes[loopindex].innerloopsControlVarname
        );
    loopsControlVarname = loopsControlVarname.filter(
        (v): v is string => typeof v === "string"
    );
    for (let i = 0; i < loopsControlVarname.length; i++)
        LoopOmpAttributes[loopindex].petit_loop_indices.push(
            loopsControlVarname[i]
        );

    let tabOP: string[] = [];

    const loopPetitForm = CovertLoopToPetitForm($ForStmt, tabOP);

    const attr = LoopOmpAttributes[loopindex];
    if (!attr) return;
    attr.ForStmtToPetit ??= [];

    attr.ForStmtToPetit.push({ line: attr.start, str: loopPetitForm });
    attr.ForStmtToPetit.push({
        line: attr.end,
        str: tabOP.join("") + "endfor",
    });

    for (const $loop of Query.searchFrom($ForStmt.body, Loop)) {
        if ($loop.astName === "ForStmt") {
            const innerloopindex = GetLoopIndex($loop);

            tabOP = [];
            for (let i = 0; i < $loop.rank.length - 1; i++) {
                tabOP.push("\t");
            }

            const loopPetitForm = CovertLoopToPetitForm($loop, tabOP);

            const innerAttr = LoopOmpAttributes[innerloopindex];

            attr.ForStmtToPetit ??= [];

            attr.ForStmtToPetit.push({
                line: innerAttr.start,
                str: loopPetitForm,
            });
            attr.ForStmtToPetit.push({
                line: innerAttr.end,
                str: tabOP.join("") + "endfor",
            });
        }
    }

    let candidateArraylist: VarAccess[] = SearchStruct(
        LoopOmpAttributes[loopindex].varAccess ?? [],
        { usedInClause: false, hasDescendantOfArrayAccess: true }
    );

    let oder = 0;
    for (let i = 0; i < candidateArraylist.length; i++) {
        let varObj = candidateArraylist[i];

        if (varObj.use.indexOf("W") === -1 || varObj.sendtoPetit === false)
            continue;

        for (let j = 0; j < varObj.varUsage.length; j++)
            if (varObj.varUsage[j].isInsideLoopHeader === false) {
                let tabOP = Array(
                    varObj.varUsage[j].parentlooprank.length
                ).join("\t");
                if (varObj.varUsage[j].use === "R") {
                    attr.ForStmtToPetit.push({
                        line: varObj.varUsage[j].line,
                        order: oder++,
                        parentlooprank:
                            varObj.varUsage[j].parentlooprank.join("_"),
                        IsdependentCurrentloop:
                            varObj.varUsage[j].IsdependentCurrentloop,
                        IsdependentInnerloop:
                            varObj.varUsage[j].IsdependentInnerloop,
                        IsdependentOuterloop:
                            varObj.varUsage[j].IsdependentOuterloop,
                        str: tabOP + "petit_tmp = " + varObj.varUsage[j].code,
                    });
                } else if (varObj.varUsage[j].use === "W") {
                    attr.ForStmtToPetit.push({
                        line: varObj.varUsage[j].line,
                        order: oder++,
                        parentlooprank:
                            varObj.varUsage[j].parentlooprank.join("_"),
                        IsdependentCurrentloop:
                            varObj.varUsage[j].IsdependentCurrentloop,
                        IsdependentInnerloop:
                            varObj.varUsage[j].IsdependentInnerloop,
                        IsdependentOuterloop:
                            varObj.varUsage[j].IsdependentOuterloop,
                        str: tabOP + varObj.varUsage[j].code + " = petit_tmp",
                    });
                } else if (varObj.varUsage[j].use === "RW") {
                    attr.ForStmtToPetit.push({
                        line: varObj.varUsage[j].line,
                        order: oder++,
                        parentlooprank:
                            varObj.varUsage[j].parentlooprank.join("_"),
                        IsdependentCurrentloop:
                            varObj.varUsage[j].IsdependentCurrentloop,
                        IsdependentInnerloop:
                            varObj.varUsage[j].IsdependentInnerloop,
                        IsdependentOuterloop:
                            varObj.varUsage[j].IsdependentOuterloop,
                        str: tabOP + "petit_tmp = " + varObj.varUsage[j].code,
                    });
                    attr.ForStmtToPetit.push({
                        line: varObj.varUsage[j].line,
                        order: oder++,
                        parentlooprank:
                            varObj.varUsage[j].parentlooprank.join("_"),
                        IsdependentCurrentloop:
                            varObj.varUsage[j].IsdependentCurrentloop,
                        IsdependentInnerloop:
                            varObj.varUsage[j].IsdependentInnerloop,
                        IsdependentOuterloop:
                            varObj.varUsage[j].IsdependentOuterloop,
                        str: tabOP + varObj.varUsage[j].code + " = petit_tmp",
                    });
                }
            }
    }

    const forStmts = LoopOmpAttributes[loopindex].ForStmtToPetit;
    if (!forStmts) return;

    for (let i = 0; i < forStmts.length; i++) {
        forStmts[i].str = forStmts[i].str.moveBracketsToEnd3(
            LoopOmpAttributes[loopindex].petit_arrays
        );
    }

    let j = -6;
    for (const key in attr.petit_arrays) {
        attr.ForStmtToPetit.push({
            line: j,
            str:
                "integer " +
                attr.petit_arrays[key].name +
                attr.petit_arrays[key].size,
        });
        j--;
        attr.ForStmtToPetit.push({
            line: j,
            str: "!------ " + attr.petit_arrays[key].name + " -> " + key,
        });
        j--;
    }
    attr.ForStmtToPetit.push({
        line: j,
        str: "!" + Array(50).join("-") + " arrays",
    });

    attr.ForStmtToPetit.push({
        line: -5,
        str: "!" + Array(50).join("-") + " loop indices",
    });
    attr.ForStmtToPetit.push({
        line: -4,
        str:
            "integer " +
            LoopOmpAttributes[loopindex].petit_loop_indices.join(","),
    });

    attr.ForStmtToPetit.push({
        line: -3,
        str: "!" + Array(50).join("-") + " variables",
    });
    attr.ForStmtToPetit.push({
        line: -2,
        str:
            "integer " + LoopOmpAttributes[loopindex].petit_variables.join(","),
    });

    attr.ForStmtToPetit.push({
        line: -1,
        str: "!" + Array(50).join("-") + " body code",
    });

    attr.ForStmtToPetit = attr.ForStmtToPetit.sort(function (obj1, obj2) {
        if (obj1.line !== obj2.line) return obj1.line - obj2.line;
        else return obj1.order - obj2.order;
    });

    let count = 1;
    let replaceloopindices: Record<string, { rep: string }> = {};
    for (const loopindices of LoopOmpAttributes[loopindex].petit_loop_indices)
        if (loopindices.length > 5) {
            replaceloopindices[loopindices] = {
                rep: "tmp" + count.toString(),
            };
            count = count + 1;
        }

    for (let i = 0; i < attr.ForStmtToPetit.length; i++) {
        for (const key in replaceloopindices)
            if (attr.ForStmtToPetit[i].str.indexOf(key) !== -1) {
                attr.ForStmtToPetit[i].str = attr.ForStmtToPetit[
                    i
                ].str.replacer(key, replaceloopindices[key].rep);
            }
    }

    for (const replace_var of replace_vars)
        for (let i = 0; i < attr.ForStmtToPetit.length; i++)
            attr.ForStmtToPetit[i].str = attr.ForStmtToPetit[i].str.replacer(
                replace_var,
                replace_var.substr(1)
            );
}

/**************************************************************
 *
 *                       CovertLoopToPetitForm
 *
 **************************************************************/
export function CovertLoopToPetitForm($ForStmt: Loop, tabOP: string[]) {
    let loopPetitForm: string = tabOP.join("") + "for ";
    const loopindex: string = GetLoopIndex($ForStmt);
    const loopAttributes: LoopOmpAttribute = LoopOmpAttributes[loopindex];
    if (loopAttributes === undefined) {
        let message = "";
        message +=
            "Could not find the loop attributes of loop " +
            loopindex +
            "@" +
            $ForStmt.location +
            ". Current attributes:\n";
        for (const key in LoopOmpAttributes) {
            message += key + ": " + LoopOmpAttributes[key];
        }

        throw message;
    }

    let loopControlVarname = loopAttributes.loopControlVarname;

    let cloneJP = null;

    for (const loop of Query.search(Loop, { kind: "for" })) {
        for (const $cast of loop.init.getDescendantsAndSelf("vardecl")) {
            // if for(int i = ... )
            cloneJP = ($cast as Vardecl).init.copy();
            continue;
        }
        for (const $cast of loop.init.getDescendantsAndSelf("binaryOp")) {
            // if for(i = ... )
            cloneJP = ($cast as BinaryOp).right.copy();
            continue;
        }
    }

    if (cloneJP) {
        for (const $cast of cloneJP.getDescendantsAndSelf("cast")) {
            const child = $cast.getChild(0);
            $cast.replaceWith(child);
        }

        for (const $cast of cloneJP.getDescendantsAndSelf("unaryOp")) {
            const child = $cast.getChild(0);
            $cast.replaceWith(child);
        }

        const str_init = cloneJP.code;

        loopPetitForm += loopControlVarname + "  =  " + str_init + "  to  ";
    }
    cloneJP = null;
    let binaryOpleft = null;
    let binaryOpRight = null;
    for (const $binaryOp of Query.searchFrom($ForStmt.cond, BinaryOp)) {
        binaryOpleft = $binaryOp.left.copy();
        binaryOpRight = $binaryOp.right.copy();
        break;
    }
    let foundflag = false;
    if (binaryOpleft)
    for (const $cast of binaryOpleft.getDescendantsAndSelf("varref"))
        if (($cast as Varref).name === loopControlVarname) {
            cloneJP = binaryOpRight;
            foundflag = true;
        }

    if (foundflag === false) cloneJP = binaryOpleft;

    if (cloneJP) {
        for (const $cast of cloneJP.getDescendantsAndSelf("cast")) {
            const child = $cast.getChild(0);
            $cast.replaceWith(child);
        }
        for (const $cast of cloneJP.getDescendantsAndSelf("unaryOp")) {
            const child = $cast.getChild(0);
            $cast.replaceWith(child);
        }

        let str_cond = cloneJP.code;

        for (const $cast of cloneJP.getDescendantsAndSelf("binaryOp")) {
            if (["shr", "shl"].indexOf(($cast as BinaryOp).kind) !== -1)
                str_cond = "9999";
        }
        loopPetitForm += str_cond;
    }

    let stepOp = null;
    cloneJP = null;
    for (const $expr of Query.searchFrom($ForStmt.step, Joinpoint)) {
        if (
            $expr.joinPointType == "binaryOp" ||
            $expr.joinPointType == "unaryOp"
        )
            stepOp = ($expr as Op).kind;

        if (stepOp === "assign" || stepOp === "add" || stepOp === "sub") {
            cloneJP = ($expr as BinaryOp).right.copy();
        }
        break;
    }

    if (stepOp === "post_inc" || stepOp === "pre_inc") {
        loopPetitForm += "  do";
    } else if (stepOp === "pre_dec" || stepOp === "post_dec") {
        loopPetitForm += "  by  -1  do";
    } else if (stepOp === "assign") {
        loopPetitForm += "  do";
    }
    return loopPetitForm;
}