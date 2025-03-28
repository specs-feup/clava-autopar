/**************************************************************
* 
*                       RunInlineFunctionCalls
* 
**************************************************************/
import clava.ClavaJoinPoints;
import clava.ClavaType;

import clava.autopar.AutoParStats;

var countCallInlinedFunction;
aspectdef RunInlineFunctionCalls
    
        
    var func_name = {};
    countCallInlinedFunction = 0;
    select file.function end
    apply
        if (func_name[$function.name] === undefined)
        {
            func_name[$function.name] = {};
            func_name[$function.name].innerCallNumber = 0;
            func_name[$function.name].CallingFunc = [];
        }
    end

    select file.function end
    apply
        var innerCalls = $function.getDescendants('call');

        func_name[$function.name].innerCallNumber = innerCalls.length;
        for(var obj of innerCalls)
            if (safefunctionCallslist.indexOf(obj.name) === -1)
                func_name[$function.name].CallingFunc.push(obj.name);
    end




    var flag = false;
    while(1)
    {
        flag = false;
        for (var caller_func in func_name)
            for(var calling of func_name[caller_func].CallingFunc)
                if (calling !== caller_func && func_name[calling] !== undefined )
                {
                    for(var func of func_name[calling].CallingFunc)
                        if (func_name[caller_func].CallingFunc.indexOf(func) ===-1 )
                        {
                            func_name[caller_func].CallingFunc.push(func);
                            flag = true;
                        }
                }

        if (flag === false)
            break;
    }


    
    var excluded_function_list = [];
    // check for recursive function calls
    for (var caller_func in func_name)
    {

        if (
            func_name[caller_func].CallingFunc.indexOf(caller_func) !== -1 &&
            excluded_function_list.indexOf(caller_func) === -1 // not exist
            )
            {
                debug("Excluding from inlining '" + caller_func + "', because it is recursive");
                excluded_function_list.push(caller_func);
                AutoParStats.get().incInlineAnalysis(AutoParStats.EXCLUDED_RECURSIVE, caller_func);
            }

    
    }
    

    select file.function end
    apply
        var innerCalls = $function.getDescendants('call');

        for(var obj of innerCalls)
            if (safefunctionCallslist.indexOf(obj.name) === -1 && func_name[obj.name] === undefined  )
                if (excluded_function_list.indexOf($function.name) === -1) { // not exist
                    debug("Excluding from inlining '" + caller_func + "', because is not considered safe (func_name[obj.name]: " + func_name[obj.name] + ")");
                    excluded_function_list.push($function.name);
                    AutoParStats.get().incInlineAnalysis(AutoParStats.EXCLUDED_IS_UNSAFE, $function.name);
                }
    end


    // Exclude functions that have global variable declarations
    select file.function.body.vardecl end
    apply
        /*
        if($vardecl.isGlobal !== ($vardecl.storageClass === 'static')) {
            console.log("DIFF!!!");
            console.log("isGlobal: " + $vardecl.isGlobal);
            console.log("Storage class: " + $vardecl.storageClass);
        }
        */

        
        if(!$vardecl.isGlobal) {
        //if($vardecl.storageClass !== 'static') {		
            continue;
        }
        
        if (excluded_function_list.indexOf($function.name) === -1) {
            debug("Excluding from inlining '" + $function.name + "', because it declares at least one global variable ("+$vardecl.name+"@"+$vardecl.location+")");
            excluded_function_list.push($function.name);
            AutoParStats.get().incInlineAnalysis(AutoParStats.EXCLUDED_GLOBAL_VAR, $function.name);
        }
    end
    //condition $vardecl.storageClass === 'static' end
    //condition $vardecl.isGlobal end

    /*
    // Exclude functions that have references to global variables
    select file.function.body.varref end
    apply
        var $vardecl = $varref.declaration;
        if($vardecl === undefined) {
            continue;
        }
    
        if(!$vardecl.isGlobal) {
            continue;
        }
    
        if (excluded_function_list.indexOf($function.name) === -1) {
            debug("Excluding from inlining '" + $function.name + "', because it has references to global variables");		
            excluded_function_list.push($function.name);
        }
    end
    */

    for (var caller_func in func_name)
        for(var calling of func_name[caller_func].CallingFunc)
            if (
                excluded_function_list.indexOf(calling) !== -1 &&
                excluded_function_list.indexOf(caller_func) === -1
                )
                {
                    debug("Excluding from inlining '" +caller_func + "', because it calls excluded function '"+calling+"'");		
                    excluded_function_list.push(caller_func);
                    AutoParStats.get().incInlineAnalysis(AutoParStats.EXCLUDED_CALLS_UNSAFE, caller_func);
                }
                
                
                
    debug("Functions excluded from inlining: " + excluded_function_list);
    AutoParStats.get().setInlineExcludedFunctions(excluded_function_list);

    var sorted = [];
    for (var key in func_name)
    {
          sorted.push([ key, func_name[key].innerCallNumber ]);
    }
    sorted.sort(function compare(obj1, obj2) {return obj1[1] - obj2[1];});

    for(i in sorted)
        if (excluded_function_list.indexOf(sorted[i][0]) === -1)
        {
            call callInline(sorted[i][0]);
        }
end



/**************************************************************
* 
*                       callInline
* 
**************************************************************/
aspectdef callInline
    input func_name end

    select file.function.call end
    apply

        var exprStmt = $call.getAstAncestor('ExprStmt');

        if (exprStmt === undefined)
        {
            continue;
        }


        if (
                    (// funcCall(...)
                    exprStmt.children[0].joinPointType === 'call' && 
                    exprStmt.getDescendantsAndSelf('call').length ===1 && 
                    exprStmt.children[0].name === func_name
                    ) 
            ||
                    (// var op funcCall(...)
                    exprStmt.children[0].joinPointType === 'binaryOp' && 
                    exprStmt.children[0].right.joinPointType === 'call' && 
                    exprStmt.children[0].right.getDescendantsAndSelf('call').length === 1
                    )
            )
            {
                // Count as an inlined call
                AutoParStats.get().incInlineCalls();

                var o = null;
                call o : inlinePreparation(func_name, $call, exprStmt);
                

                if(o.$newStmts.length > 0)
                {
                    var replacedCallStr = '// ClavaInlineFunction : ' + exprStmt.code + '  countCallInlinedFunction : ' + countCallInlinedFunction;
    
                    // Insert after to preserve order of comments
                    var currentStmt = exprStmt.insertAfter(replacedCallStr);				
                    for(var $newStmt of o.$newStmts)
                    {
                        currentStmt = currentStmt.insertAfter($newStmt);
                    }

                    exprStmt.detach();
                }
            }

    end
    condition $call.name === func_name && $call.getAstAncestor('ForStmt') !== undefined end

    //call aspec_rebuild;
end	


aspectdef aspec_rebuild
    select program end
    apply
        $program.rebuild();
    end 
end

/**************************************************************
* 
*                       inlinePreparation
* 
**************************************************************/
aspectdef inlinePreparation
    input func_name, callStmt, exprStmt end
    output replacedCallStr, $newStmts end

    this.replacedCallStr = '';

    this.$newStmts = [];	

    var funcJP = null;
    var funcJP_backup = null;
    select function end
    apply
        funcJPOrginal = $function;

        funcJP = $function.clone(func_name + '_clone');

        funcJP_backup = $function.copy();
        funcJP_backupCode = $function.code;
        funcAst_backup = $function.ast;

        break;
    end
    condition $function.name === func_name && $function.hasDefinition === true end

    if (funcJP === null)
    {
        debug("RunInlineFunctionCalls::inlinePreparation: Could not find the definition of function " + func_name);
        //funcJP.detach();
        return;
    }

    returnStmtJPs = [];
    select funcJP.body.stmt end
    apply
        returnStmtJPs.push($stmt);
    end
    condition $stmt.astName === 'ReturnStmt' end

    if (
        funcJP.functionType.returnType.code === 'void'
        &&
            (
                returnStmtJPs.length > 1 || 
                (returnStmtJPs.length === 1 && returnStmtJPs[0].isLast === false )
            )
        )
    {
        funcJP.detach();
        return;
    }
    else // function return !== void
    {
        if  (
                returnStmtJPs.length > 1 || 
                (returnStmtJPs.length === 1 && returnStmtJPs[0].isLast === false )
            )
        {
            funcJP.detach();
            return;
        }

    }
    
    if (funcJP.functionType.returnType.code === 'void' && returnStmtJPs.length === 1)
    {
        returnStmtJPs[0].detach();
    }

    countCallInlinedFunction = countCallInlinedFunction + 1;

    var param_table = {};

    select funcJP.body.vardecl end
    apply
        if ($vardecl.qualifiedName !== $vardecl.name)
            continue;

        var newDeclName = $vardecl.qualifiedName + "_" + countCallInlinedFunction;
        param_table[$vardecl.name] = newDeclName;
        $vardecl.name =  newDeclName;

    end


    select funcJP.body.varref end
    apply
        var varrefName = $varref.name;
        var newVarrefName = updateVarrefName(varrefName, param_table);
        if(varrefName !== newVarrefName) {
            $varref.setName(newVarrefName);
        }
    end
    
    select funcJP.body.varref end
    apply
        $varref.useExpr.replaceWith($varref);		
    end
    condition $varref.vardecl !== undefined && $varref.vardecl.isParam && $varref.kind === 'pointer_access' end
    

    var param_index = 0;
    param_table = {};
    select funcJP.param end
    apply
        if ($param.type.code.indexOf('void ') !== -1)
        {
            funcJP.detach();
            return;			
        }

        if ($param.type.isBuiltin === true)
        {			
            var orgparamName = $param.qualifiedName;
            param_table[$param.name] = $param.qualifiedName + "_" + countCallInlinedFunction;			
            $param.name = param_table[$param.name];

            $newVardecl = ClavaJoinPoints.varDecl($param.name, callStmt.argList[param_index].copy());

            funcJP.body.insertBegin($newVardecl);			
        }
        
        else if ($param.type.isArray === true)
        {
            if (callStmt.argList[param_index].joinPointType === 'unaryOp')
            {
                funcJP.detach();
                return;

                var arrayVarObj = callStmt.argList[param_index].getDescendantsAndSelf('arrayAccess')[0];

                param_table[$param.name] = arrayVarObj.arrayVar.code;
                for(var index = 0 ; index < arrayVarObj.subscript.length - ($param.code.split('[').length-1) ; index++)
                {
                    param_table[$param.name] += '[' + arrayVarObj.subscript[index].code +']';
                }				
            }
            else if (callStmt.argList[param_index].joinPointType === 'cast')
            {

                if (callStmt.argList[param_index].vardecl.type.unwrap.code !== callStmt.argList[param_index].type.unwrap.code)
                {
                    funcJP.detach();
                    return;
                }

                param_table[$param.name] = callStmt.argList[param_index].subExpr.code;				
            }
            else
            {
                param_table[$param.name] = callStmt.argList[param_index].code;
            }
            $param.name = param_table[$param.name];
        }
        else if ($param.type.isPointer === true)
        {
            param_table[$param.name] = callStmt.argList[param_index].code.allReplace({'&':''});
            $param.name =  param_table[$param.name];

        }
        param_index = param_index + 1;
    end

    
    select funcJP.body.varref end
    apply

        if (param_table[$varref.name] !== undefined)
        $varref.setName(param_table[$varref.name]);
    end
    condition $varref.vardecl.isParam === true  end	
    
    select funcJP.body.vardecl end
    apply        
        var varrefs = [];
        var $typeCopy = ClavaType.getVarrefsInTypeCopy($vardecl.type, varrefs);

        for(var $varref of varrefs)
        {
            $varref.name = param_table[$varref.name];
        }
                
        $vardecl.type = $typeCopy;
    end
    


    if (exprStmt.children[0].joinPointType === 'binaryOp')
    {
        var ret_str_replacement = exprStmt.children[0].children[0].code;

        if (exprStmt.children[0].kind === 'assign')
            ret_str_replacement += ' = ';
        else if (exprStmt.children[0].kind === 'add_assign')
            ret_str_replacement += ' += ';
        else if (exprStmt.children[0].kind === 'sub_assign')
            ret_str_replacement += ' -= ';
        else if (exprStmt.children[0].kind === 'mul_assign')
            ret_str_replacement += ' *= ';
//		else	
//			throw "Not implemented for kind " + exprStmt.children[0].kind;

        //retJPs = funcJP.body.stmts.filter(function(obj){if (obj.astName === 'ReturnStmt') {return obj;}});
        retJPs = funcJP.body.allStmts.filter(function(obj){if (obj.astName === 'ReturnStmt') {return obj;}});		
        
        for(retJP of retJPs)
        {
            //console.log("ret_str_repl: " + ret_str_replacement);
            //console.log("retJP original: " + retJP.code);
            //console.log("retJP after: " + ret_str_replacement + retJP.children[0].code + ';');
            //console.log("retJp child: " + retJP.children[0]);
            //retJP.insert replace ret_str_replacement + retJP.children[0].code + ';';
            
            // Copy binary operation stmt
            var exprStmtCopy = exprStmt.copy();
            var binaryOpCopy = exprStmtCopy.children[0];
            // Replace right hand with return expression
            binaryOpCopy.right = retJP.children[0];

            //console.log("PREVIOUS CODE: " + ret_str_replacement + retJP.children[0].code + ';');
            //console.log("CURRENT CODE: " + exprStmtCopy.code);
            // Replace return with copy of expr stmt
            retJP.replaceWith(exprStmtCopy);
        }

    }

    select funcJP.body.comment end
    apply
        $comment.detach();
    end

    //var changedReplacedCall = false;
    select funcJP.body.childStmt end
    apply
        this.$newStmts.push($childStmt.copy());
        this.replacedCallStr += $childStmt.code + '\n';
        //changedReplacedCall = true;
        //console.log("ADDING: " + $childStmt.code);
    end

    this.replacedCallStr = this.replacedCallStr.allReplace({' const ':' '});

    funcJP.detach();
end	


function updateVarrefName(varrefName, param_table) {
        
        // If name is present in the table, return table value
        if (param_table[varrefName] !== undefined) {
            return param_table[varrefName];
        }
        
        // If name has a square bracket, it means it is array access
        // Update the name of the array, and the contents of each subscript
        
        var bracketIndex = varrefName.indexOf("[");
        if(bracketIndex != -1) {
            var accessName = varrefName.substring(0, bracketIndex);
            var newAccessName = updateVarrefName(accessName, param_table);
            var suffix = varrefName.substring(bracketIndex);
            var updatedSuffix = updateSubscripts(suffix, param_table);
            
            return newAccessName + updatedSuffix;
        }


        // Return the current name
        return varrefName;
}

function updateSubscripts(subscripts, param_table) {
    //console.log("Original subscripts: '" + subscripts + "'");

    var idRegex = /[a-zA-Z_][a-zA-Z_0-9]*/g;
    var match = idRegex['exec'](subscripts);

    var startIndex = 0;
    var updatedSubscripts = "";
    while (match != null) {
        // matched text: match[0]
        // match start: match.index
        // capturing group n: match[n]
        var matched = match[0];
        var matchedIndex = match.index;
        //console.log(matched);
        //console.log(matchedIndex);
        match = idRegex['exec'](subscripts);
            
        var newMatched = updateVarrefName(matched, param_table);
        
        updatedSubscripts += subscripts.substring(startIndex, matchedIndex);
        updatedSubscripts += newMatched;
        
        startIndex = matchedIndex + matched.length;
        
        //console.log("Current String: '" + updatedSubscripts + "'");
    }
    
    // Complete string
    updatedSubscripts += subscripts.substring(startIndex, subscripts.length);
    //console.log("Updated subscripts: '" + updatedSubscripts + "'");
    
    return updatedSubscripts;
}