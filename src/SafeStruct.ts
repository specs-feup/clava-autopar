/**************************************************************
 *
 *                       SearchStruct
 *
 **************************************************************/
export default function SearchStruct(structObj: any, criteria: any) {
    return structObj.filter(function (obj: { [x: string]: any; }) {
        return Object.keys(criteria).every(function (c) {
            if (typeof obj[c] === "string") {
                return obj[c].toUpperCase() === criteria[c].toUpperCase();
            } else {
                return obj[c] === criteria[c];
            }
        });
    });
}