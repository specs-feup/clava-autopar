import {
    FunctionJp,
    Loop,
} from "@specs-feup/clava/api/Joinpoints.js";
import { LoopOmpAttributes } from "./checkForOpenMPCanonicalForm.js";
import GetLoopIndex from "./GetLoopIndex.js";
import { OmpPragmas } from "./Parallelize.js";

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
