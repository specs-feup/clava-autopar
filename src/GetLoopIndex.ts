import { FunctionJp, Loop } from "@specs-feup/clava/api/Joinpoints.js";

/**************************************************************
 *
 *                       GetLoopIndex
 *
 **************************************************************/
export default function GetLoopIndex($loop: Loop) {
    return (
        ($loop.getAstAncestor("FunctionDecl") as FunctionJp).name +
        "_" +
        $loop.rank.join("_")
    );
}
