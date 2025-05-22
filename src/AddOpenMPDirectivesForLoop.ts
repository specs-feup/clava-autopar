import {
    FunctionJp,
    Loop,
} from "@specs-feup/clava/api/Joinpoints.js";
import { LoopOmpAttributes } from "./checkForOpenMPCanonicalForm.js";
import GetLoopIndex from "./GetLoopIndex.js";
import { OmpPragmas } from "./Parallelize.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";

/**************************************************************
/**************************************************************
* 
*                       AddOpenMPDirectivesForLoop
* 
**************************************************************/
export default function AddOpenMPDirectivesForLoop($ForStmt: Loop) {
    const loopindex = GetLoopIndex($ForStmt);

    if (typeof LoopOmpAttributes[loopindex] === "undefined") {
        return;
    }

    let msgError = LoopOmpAttributes[loopindex].msgError;
    if (typeof msgError === "undefined") msgError = [];

    let InsertBeforeStr = "";

    if (msgError.length > 0) {
        InsertBeforeStr =
            "/*" +
            Array(15).join("*") +
            " Clava msgError " +
            Array(15).join("*") +
            "\n\t\t" +
            msgError.join("\n\t\t") +
            "\n" +
            Array(40).join("*") +
            "*/";
    } else {
        const privateVars = LoopOmpAttributes[loopindex].privateVars!;
        const firstprivateVars = LoopOmpAttributes[loopindex].firstprivateVars!;
        const lastprivateVars = LoopOmpAttributes[loopindex].lastprivateVars!;
        const reduction = LoopOmpAttributes[loopindex].Reduction!;
        const depPetitFileName = LoopOmpAttributes[loopindex].DepPetitFileName!;

        let OpenMPDirectivesStr = "#pragma omp parallel for ";

        OpenMPDirectivesStr += " default(shared) ";

        /*
        call o : ret_IF_Clause($ForStmt);
        OpenMPDirectivesStr += ' ' + o.IF_Clause_str + ' ';
        */

        /*
        call o : ret_NUM_THREADS_Clause($ForStmt);
        OpenMPDirectivesStr += ' ' + o.NUM_THREADS_Clause_str + ' ';
        */

        if (privateVars.length > 0)
            OpenMPDirectivesStr += "private(" + privateVars.join(", ") + ") ";

        if (firstprivateVars.length > 0)
            OpenMPDirectivesStr +=
                "firstprivate(" + firstprivateVars.join(", ") + ") ";

        if (lastprivateVars.length > 0)
            OpenMPDirectivesStr +=
                "lastprivate(" + lastprivateVars.join(", ") + ") ";

        if (reduction.length > 0)
            OpenMPDirectivesStr += reduction.join("  ") + " ";

        if (depPetitFileName !== null && depPetitFileName.length > 0)
            OpenMPDirectivesStr += "\n// " + depPetitFileName;

        InsertBeforeStr = OpenMPDirectivesStr;
    }

    // Insert pragma
    $ForStmt.insert("before", InsertBeforeStr);

    // Add include - not working...
    //$ForStmt.getAncestor('file').addInclude("omp", true);

    const $body = $ForStmt.body;

    if (!$body.hasChildren) {
        return;
    }

    if ($body.getChild(0).code.indexOf("//loopindex") !== -1) {
        const loopindex_org = $body.children[0].code.split(" ")[1].trim();
        const func_name = ($ForStmt.getAncestor("function") as FunctionJp).name;
        if (loopindex_org.indexOf(func_name) !== -1) {
            if (OmpPragmas[loopindex_org] === undefined) {
                OmpPragmas[loopindex_org] = {
                    pragmaCode: InsertBeforeStr,
                };
            } else {
                return;
            }
        }
    }
}

// function ret_IF_Clause($ForStmt: Loop) {
//     const loopindex = GetLoopIndex($ForStmt);
//     const loopControlVarname = LoopOmpAttributes[loopindex].loopControlVarname;
//     let IF_Clause_str = "if(abs(";

//     let cloneJP = null;

//     const $init = $ForStmt.init;

//     for (const $cast of $init.getDescendantsAndSelf("vardecl")) {
//         cloneJP = ($cast as Vardecl).init.copy();
//         break;
//     }
//     for (const $cast of $init.getDescendantsAndSelf("binaryOp")) {
//         cloneJP = ($cast as BinaryOp).right.copy();
//         break;
//     }

//     if (cloneJP) {
//         for (const $cast of cloneJP.getDescendantsAndSelf("cast")) {
//             const child = $cast.getChild(0);
//             $cast.replaceWith(child);
//         }

//         for (const $cast of cloneJP.getDescendantsAndSelf("unaryOp")) {
//             const child = $cast.getChild(0);
//             $cast.replaceWith(child);
//         }

//         IF_Clause_str += cloneJP.code + " - ";
//     } else throw new Error("cloneJP not defined");

//     cloneJP = null;
//     let binaryOpleft = null;
//     let binaryOpRight = null;
//     for (const $ForStmt of Query.search(Loop)) {
//         const $binaryOp = Query.searchFrom($ForStmt.cond, BinaryOp).getFirst();
//         if ($binaryOp) {
//             binaryOpleft = $binaryOp.left.copy();
//             binaryOpRight = $binaryOp.right.copy();
//         }
//         break;
//     }
//     let foundflag = false;
//     if (binaryOpleft) {
//         for (const $cast of binaryOpleft.getDescendantsAndSelf("varref"))
//             if (($cast as Varref).name === loopControlVarname) {
//                 cloneJP = binaryOpRight;
//                 foundflag = true;
//             }
//     } else throw new Error("binaryOpleft not defined");

//     if (foundflag === false) cloneJP = binaryOpleft;

//     if (cloneJP) {
//         for (const $cast of cloneJP.getDescendantsAndSelf("cast")) {
//             const child = $cast.getChild(0);
//             $cast.replaceWith(child);
//         }
//         for (const $cast of cloneJP.getDescendantsAndSelf("unaryOp")) {
//             const child = $cast.getChild(0);
//             $cast.replaceWith(child);
//         }

//         IF_Clause_str += cloneJP.code;
//         IF_Clause_str += ")>500)";
//     } else throw Error("cloneJP not defined");

//     return IF_Clause_str;
// }

// function ret_NUM_THREADS_Clause($ForStmt: Loop) {
//     const loopindex = GetLoopIndex($ForStmt);
//     const loopControlVarname = LoopOmpAttributes[loopindex].loopControlVarname;
//     let NUM_THREADS_Clause_str = "num_threads((abs(";

//     let cloneJP = null;

//     for (const $ForStmt of Query.search(Loop, { kind: "for" })) {
//         let $cast = $ForStmt.init.getDescendantsAndSelf("vardecl")[0]; // if for(int i = ... )
//         if ($cast) {
//             cloneJP = ($cast as Vardecl).init.copy();
//             break;
//         }

//         $cast = $ForStmt.init.getDescendantsAndSelf("binaryOp")[0]; // if for(i = ... )
//         if ($cast) {
//             cloneJP = ($cast as BinaryOp).right.copy();
//             break;
//         }
//     }

//     if (cloneJP) {
//         for (const $cast of cloneJP.getDescendantsAndSelf("cast")) {
//             const child = $cast.getChild(0);
//             $cast.replaceWith(child);
//         }

//         for (const $cast of cloneJP.getDescendantsAndSelf("unaryOp")) {
//             const child = $cast.getChild(0);
//             $cast.replaceWith(child);
//         }

//         NUM_THREADS_Clause_str += cloneJP.code + " - ";
//     } else {
//         throw new Error("cloneJP is not defined");
//     }

//     cloneJP = null;
//     let binaryOpleft = null;
//     let binaryOpRight = null;
//     for (const $ForStmt of Query.search(Loop)) {
//         const $binaryOp = Query.searchFrom($ForStmt.cond, BinaryOp).getFirst();
//         if ($binaryOp) {
//             binaryOpleft = $binaryOp.left.copy();
//             binaryOpRight = $binaryOp.right.copy();
//         }
//         break;
//     }

//     let foundflag = false;
//     if (binaryOpleft) {
//         for (const $cast of binaryOpleft.getDescendantsAndSelf("varref"))
//             if (($cast as Varref).name === loopControlVarname) {
//                 cloneJP = binaryOpRight;
//                 foundflag = true;
//             }
//     } else throw new Error("binaryOpleft not defined");

//     if (foundflag === false) cloneJP = binaryOpleft;

//     if (cloneJP) {
//         for (const $cast of cloneJP.getDescendantsAndSelf("cast")) {
//             const child = $cast.getChild(0);
//             $cast.replaceWith(child);
//         }
//         for (const $cast of cloneJP.getDescendantsAndSelf("unaryOp")) {
//             const child = $cast.getChild(0);
//             $cast.replaceWith(child);
//         }

//         NUM_THREADS_Clause_str += cloneJP.code;
//         NUM_THREADS_Clause_str += ")<500)?1:omp_get_max_threads())";
//     } else throw new Error("cloneJP not defined");

//     return NUM_THREADS_Clause_str;
// }
