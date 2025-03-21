import { type VarAccess } from "./SetVariableAccess.js";

export default function SearchStruct(
    structObj: VarAccess[],
    criteria: Partial<VarAccess>
) {
    return structObj.filter(function (obj) {
        return Object.keys(criteria).every(function (c) {
            const key = c as keyof VarAccess;
            if (
                typeof obj[key] === "string" &&
                typeof criteria[key] === "string"
            ) {
                return obj[key].toUpperCase() === criteria[key].toUpperCase();
            } else {
                return obj[key] === criteria[key];
            }
        });
    });
}
