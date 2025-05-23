import {
    Type,
    FunctionJp,
    FileJp,
    Call,
    Vardecl,
    ExprStmt,
    BinaryOp,
    ReturnStmt,
    Varref,
    Param,
    Cast,
    Statement,
    Expression,
    Comment,
} from "@specs-feup/clava/api/Joinpoints.js";
import AutoParStats from "./AutoParStats.js";
import { allReplace } from "./allReplace.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";
import { safefunctionCallslist } from "./SafeFunctionCalls.js";
import ClavaJoinPoints from "@specs-feup/clava/api/clava/ClavaJoinPoints.js";
import ClavaType from "@specs-feup/clava/api/clava/ClavaType.js";
import { debug, } from "@specs-feup/lara/api/lara/core/LaraCore.js";
import { object2string } from "@specs-feup/lara/api/core/output.js";


/**************************************************************
 *
 *                       RunInlineFunctionCalls
 *
 **************************************************************/

interface FunctionData {
    innerCallNumber: number;
    CallingFunc: string[];
}

const func_name: Record<string, FunctionData> = {};
let countCallInlinedFunction: number = 0;

export function RunInlineFunctionCalls(): void {
    for (const $function of Query.search(FileJp).search(FunctionJp)) {
        func_name[$function.name] ??= {
            innerCallNumber: 0,
            CallingFunc: [],
        };
    }

    for (const $function of Query.search(FileJp).search(FunctionJp)) {
        const innerCalls = $function.getDescendants("call") as Call[];
        func_name[$function.name] = {
            innerCallNumber: innerCalls.length,
            CallingFunc: [],
        };

        for (const obj of innerCalls) {
            const callName = obj.name;
            if (!safefunctionCallslist.includes(callName)) {
                func_name[$function.name].CallingFunc.push(callName);
            }
        }
    }

    let flag = false;
    while (true) {
        flag = false;
        for (const caller_func in Object.keys(func_name))
            for (const calling of func_name[caller_func].CallingFunc)
                if (
                    calling !== caller_func &&
                    func_name[calling] !== undefined
                ) {
                    for (const func of func_name[calling].CallingFunc)
                        if (
                            !func_name[caller_func].CallingFunc.includes(func)
                        ) {
                            func_name[caller_func].CallingFunc.push(func);
                            flag = true;
                        }
                }

        if (!flag) break;
    }

    const excluded_function_list: string[] = [];
    // check for recursive function calls
    for (const callerFunc of Object.keys(func_name)) {
        if (
            func_name[callerFunc].CallingFunc.includes(callerFunc) &&
            !excluded_function_list.includes(callerFunc)
        ) {
            debug(
                "Excluding from inlining '" +
                    callerFunc +
                    "', because it is recursive"
            );
            excluded_function_list.push(callerFunc);
            AutoParStats.get().incInlineAnalysis(
                AutoParStats.EXCLUDED_RECURSIVE,
                callerFunc
            );
        }
    }

    for (const $function of Query.search(FileJp).search(FunctionJp)) {
        const innerCalls = $function.getDescendants("call") as Call[];
        func_name[$function.name] = {
            innerCallNumber: innerCalls.length,
            CallingFunc: [],
        };

        for (const obj of innerCalls) {
            const callName = obj.name;

            if (
                !safefunctionCallslist.includes(callName) &&
                func_name[callName] === undefined
            ) {
                if (!excluded_function_list.includes($function.name)) {
                    debug(
                        "Excluding from inlining '" +
                            $function.name +
                            "', because is not considered safe (func_name[obj.name]: " +
                            object2string(func_name[obj.name]) +
                            ")"
                    );
                    excluded_function_list.push($function.name);
                    AutoParStats.get().incInlineAnalysis(
                        AutoParStats.EXCLUDED_IS_UNSAFE,
                        $function.name
                    );
                }
            }
        }
    }

    // Exclude functions that have global variable declarations
    for (const $function of Query.search(FileJp).search(FunctionJp)) {
        for (const $vardecl of Query.searchFrom($function.body, Vardecl)) {
            if (!$vardecl.isGlobal) {
                continue;
            }

            if (excluded_function_list.indexOf($vardecl.name) === -1) {
                debug(
                    "Excluding from inlining '" +
                        $vardecl.name +
                        "', because it declares at least one global variable (" +
                        $vardecl.name +
                        "@" +
                        $vardecl.location +
                        ")"
                );
                excluded_function_list.push($vardecl.name);
                AutoParStats.get().incInlineAnalysis(
                    AutoParStats.EXCLUDED_GLOBAL_VAR,
                    $vardecl.name
                );
            }

            for (const caller_func in Object.keys(func_name))
                for (const calling of func_name[caller_func].CallingFunc)
                    if (
                        excluded_function_list.includes(calling) &&
                        !excluded_function_list.includes(caller_func)
                    ) {
                        debug(
                            "Excluding from inlining '" +
                                caller_func +
                                "', because it calls excluded function '" +
                                calling +
                                "'"
                        );
                        excluded_function_list.push(caller_func);
                        AutoParStats.get().incInlineAnalysis(
                            AutoParStats.EXCLUDED_CALLS_UNSAFE,
                            caller_func
                        );
                    }

            debug(
                "Functions excluded from inlining: " + excluded_function_list
            );
            AutoParStats.get().setInlineExcludedFunctions(
                excluded_function_list
            );

            const sorted: [string, number][] = [];

            for (const key of Object.keys(func_name)) {
                sorted.push([key, func_name[key].innerCallNumber]);
            }

            sorted.sort((obj1, obj2) => obj1[1] - obj2[1]);

            for (const [funcName] of sorted) {
                if (!excluded_function_list.includes(funcName)) {
                    callInline(funcName);
                }
            }
        }
    }
}

/**************************************************************
 *
 *                       callInline
 *
 **************************************************************/
function callInline(func_name: string): void {
    for (const $call of Query.search(FileJp).search(FunctionJp).search(Call)) {
        const exprStmt = $call.getAncestor("ExprStmt") as ExprStmt;

        if (exprStmt === undefined) {
            continue;
        }

        if (
            // funcCall(...)
            (exprStmt.children[0] instanceof Call &&
                exprStmt.getDescendantsAndSelf("call").length === 1 &&
                (exprStmt.children[0]).name === func_name) || // var op funcCall(...)
            (exprStmt.children[0] instanceof BinaryOp &&
                (exprStmt.children[0]).right.joinPointType ===
                    "call" &&
                (exprStmt.children[0]).right.getDescendantsAndSelf(
                    "call"
                ).length === 1)
        ) {
            // Count as an inlined call
            AutoParStats.get().incInlineCalls();

            const o = inlinePreparation(func_name, $call, exprStmt);

            if (o !== undefined) {
                if (o.$newStmts.length > 0) {
                    const replacedCallStr = `// ClavaInlineFunction : ${exprStmt.code}  countCallInlinedFunction : ${countCallInlinedFunction}`;

                    // Insert after to preserve order of comments
                    let currentStmt = exprStmt.insertAfter(replacedCallStr);
                    for (const newStmt of o.$newStmts) {
                        currentStmt = currentStmt.insertAfter(newStmt);
                    }

                    exprStmt.detach();
                }
            }
        }

        if ($call.name === func_name && $call.getAncestor("ForStmt") != null) {
            //call aspec_rebuild;
        }
    }
}
// function aspec_rebuild(): void {
//     (Query.root() as Program).rebuild();
// }

/**************************************************************
 *
 *                       inlinePreparation
 *
 **************************************************************/
interface ReplacedStruct {
    replacedStr: string;
    $newStmts: Statement[];
}

function inlinePreparation(
    func_name: string,
    callStmt: Call,
    exprStmt: ExprStmt
): ReplacedStruct | undefined {
    let replacedCallStr: string = "";
    const $newStmts: Statement[] = [];

    let funcJP = null;

    for (const $function of Query.search(FunctionJp)) {
        if ($function.name === func_name && $function.isImplementation) {
            funcJP = $function.clone(`${func_name}_clone`);
            break;
        }
    }

    if (funcJP === null) {
        debug(
            "RunInlineFunctionCalls::inlinePreparation: Could not find the definition of function " +
                func_name
        );
        return;
    }

    const returnStmtJPs: ReturnStmt[] = [];

    for (const $function of Query.search(FunctionJp)) {
        for (const $stmt of Query.searchFrom($function.body, ReturnStmt)) {
            returnStmtJPs.push($stmt);
        }
    }

    if (
        returnStmtJPs.length > 1 ||
        (returnStmtJPs.length === 1 && !returnStmtJPs[0].isLast)
    ) {
        funcJP.detach();
        return;
    } // function return !== void

    if (
        funcJP.functionType.returnType.code === "void" &&
        returnStmtJPs.length === 1
    ) {
        returnStmtJPs[0].detach();
    }

    countCallInlinedFunction = countCallInlinedFunction + 1;

    let param_table: Record<string, string> = {};

    for (const $function of Query.search(FunctionJp)) {
        for (const $vardecl of Query.searchFrom($function.body, Vardecl)) {
            if ($vardecl.qualifiedName !== $vardecl.name) continue;

            const newDeclName: string =
                $vardecl.qualifiedName + "_" + countCallInlinedFunction;
            param_table[$vardecl.name] = newDeclName;
            $vardecl.name = newDeclName;
        }
    }

    for (const $function of Query.search(FunctionJp)) {
        for (const $varref of Query.searchFrom($function.body, Varref)) {
            const varrefName: string = $varref.name;
            const newVarrefName: string = updateVarrefName(
                varrefName,
                param_table
            );
            if (varrefName !== newVarrefName) {
                $varref.setName(newVarrefName);
            }
        }
    }

    for (const $function of Query.search(FunctionJp)) {
        for (const $varref of Query.searchFrom($function.body, Varref)) {
            if (
                $varref.vardecl !== undefined &&
                $varref.vardecl.isParam &&
                $varref.kind === "pointer_access"
            )
                $varref.useExpr.replaceWith($varref);
        }
    }

    let param_index: number = 0;
    param_table = {};

    for (const $param of Query.search(FunctionJp).search(Param)) {
        if ($param.type.code.indexOf("void ") !== -1) {
            funcJP.detach();
            return;
        }

        if ($param.type.isBuiltin) {
            param_table[$param.name] =
                $param.qualifiedName + "_" + countCallInlinedFunction;
            $param.name = param_table[$param.name];

            const $newVardecl = ClavaJoinPoints.varDecl(
                $param.name,
                callStmt.argList[param_index].copy()
            );

            funcJP.body.insertBegin($newVardecl);
        } else if ($param.type.isArray === true) {
            if (callStmt.argList[param_index].joinPointType === "unaryOp") {
                funcJP.detach();
                return;
            } else if (callStmt.argList[param_index].joinPointType === "cast") {
                if (
                    callStmt.argList[param_index].vardecl.type.unwrap.code !==
                    callStmt.argList[param_index].type.unwrap.code
                ) {
                    funcJP.detach();
                    return;
                }

                param_table[$param.name] = (
                    callStmt.argList[param_index] as Cast
                ).subExpr.code;
            } else {
                param_table[$param.name] = callStmt.argList[param_index].code;
            }
            $param.name = param_table[$param.name];
        } else if ($param.type.isPointer) {
            param_table[$param.name] = allReplace(
                callStmt.argList[param_index].code,
                { "&": "" }
            );
            $param.name = param_table[$param.name];
        }
        param_index = param_index + 1;
    }

    for (const $function of Query.search(FunctionJp)) {
        for (const $varref of Query.searchFrom($function.body, Varref)) {
            if (
                param_table[$varref.name] !== undefined &&
                $varref.vardecl.isParam
            )
                $varref.setName(param_table[$varref.name]);
        }
    }

    for (const $function of Query.search(FunctionJp)) {
        for (const $vardecl of Query.searchFrom($function.body, Vardecl)) {
            const varrefs: Varref[] = [];
            const $typeCopy: Type = ClavaType.getVarrefsInTypeCopy(
                $vardecl.type,
                varrefs
            );

            for (const $varref of varrefs) {
                $varref.name = param_table[$varref.name];
            }

            $vardecl.type = $typeCopy;
        }
    }

    if (exprStmt.children[0].joinPointType === "binaryOp") {
        const retJPs: Statement[] = funcJP.body.allStmts.filter(function (obj) {
            if (obj.astName === "ReturnStmt") {
                return obj;
            }
        });

        for (const retJP of retJPs) {
            // Copy binary operation stmt
            const exprStmtCopy = exprStmt.copy() as ExprStmt;
            const binaryOpCopy = exprStmtCopy.children[0] as BinaryOp;
            // Replace right hand with return expression
            binaryOpCopy.right = retJP.children[0] as Expression;

            retJP.replaceWith(exprStmtCopy);
        }
    }

    for (const $function of Query.search(FunctionJp)) {
        for (const $comment of Query.searchFrom($function.body, Comment)) {
            $comment.detach();
        }
    }

    for (const $function of Query.search(FunctionJp)) {
        for (const $childStmt of Query.searchFrom($function.body, Statement)) {
            $newStmts.push($childStmt.copy() as Statement);
            replacedCallStr += $childStmt.code + "\n";
        }
    }
    replacedCallStr = allReplace(replacedCallStr, { " const ": " " });

    funcJP.detach();

    return { replacedStr: replacedCallStr, $newStmts };
}

function updateVarrefName(
    varrefName: string,
    param_table: Record<string, string>
): string {
    // If name is present in the table, return table value
    if (param_table[varrefName] !== undefined) {
        return param_table[varrefName];
    }

    // If name has a square bracket, it means it is array access
    // Update the name of the array, and the contents of each subscript

    const bracketIndex: number = varrefName.indexOf("[");
    if (bracketIndex != -1) {
        const accessName: string = varrefName.substring(0, bracketIndex);
        const newAccessName: string = updateVarrefName(accessName, param_table);
        const suffix: string = varrefName.substring(bracketIndex);
        const updatedSuffix: string = updateSubscripts(suffix, param_table);

        return newAccessName + updatedSuffix;
    }

    // Return the current name
    return varrefName;
}

function updateSubscripts(
    subscripts: string,
    param_table: Record<string, string>
) {
    const idRegex = /[a-zA-Z_]\w*/g;
    let match = idRegex["exec"](subscripts);

    let startIndex = 0;
    let updatedSubscripts = "";

    while (match != null) {
        // matched text: match[0]
        // match start: match.index
        // capturing group n: match[n]
        const matched = match[0];
        const matchedIndex = match.index;
        match = idRegex["exec"](subscripts);

        const newMatched = updateVarrefName(matched, param_table);

        updatedSubscripts += subscripts.substring(startIndex, matchedIndex);
        updatedSubscripts += newMatched;

        startIndex = matchedIndex + matched.length;
    }

    // Complete string
    updatedSubscripts += subscripts.substring(startIndex);

    return updatedSubscripts;
}
