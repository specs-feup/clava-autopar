import { BinaryOp } from "@specs-feup/clava/api/Joinpoints.js";

export function NormalizedBinaryOp(binaryOps : BinaryOp[]) {
    for (var op of binaryOps){
        if (op.astName === 'CompoundAssignOperator')
            var compoundOp = null;
            if (op.kind === 'add')
                compoundOp = '+';
            else if (op.kind === 'sub')
                compoundOp = '-';
            else if (op.kind === 'mul')
                compoundOp = '*';
            else if (op.kind === 'div')
                compoundOp = '/';

            if (compoundOp !== null)
                op.insert("replace", `${op.left.code} = ${op.left.code} ${compoundOp} ( ${op.right.code} )`) ;
    }
}