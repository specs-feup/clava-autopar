/**************************************************************
* 
*                       InlineFunctionCalls
* 
**************************************************************/
aspectdef InlineFunctionCalls

    var func_name = {};

    select file.function end
    apply
        if (func_name[$function.name] === undefined)
        {
            func_name[$function.name] = {};
            func_name[$function.name].innerCallNumber = 0;
        }
    end

    select file.function end
    apply
        var innerCalls = $function.getDescendants('call');
        func_name[$function.name].innerCallNumber = innerCalls.length;
    end


    var sorted = [];
    for (var key in func_name)
    {
          sorted.push([ key, func_name[key].innerCallNumber ]);
    }
    sorted.sort(function compare(obj1, obj2) {return obj1[1] - obj2[1];});


    for(i in sorted)
    {
        call inlineFunction(sorted[i][0]);
    }	



    return;
end

/**************************************************************
* 
*                       inlineFunction
* 
**************************************************************/
aspectdef inlineFunction
    input funcname end

    select file.function.loop.call end
    apply
            if (
                $call.getAstAncestor('ForStmt') === undefined ||  
                $call.getAstAncestor('ForStmt').rank.join('_') === $loop.rank.join('_')
                )
            {
                $call.exec inline;
            }

    end
    condition $call.name === funcname end
end