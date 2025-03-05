import Clava from "@specs-feup/clava/api/clava/Clava.js";
import CodeInserter from "@specs-feup/clava/api/clava/util/CodeInserter.js";
import Io from "@specs-feup/lara/api/lara/Io.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";
import { Loop, Joinpoint, If, ArrayAccess, Continue, MemberAccess, Varref } from "@specs-feup/clava/api/Joinpoints.js";

// TODO FINISH
export function CheckForSafeFunctionCall($function : Function[],$arrayAccess : ArrayAccess,$memberAccess : MemberAccess,$varref : Varref, $file : File) {
    var new_safefunctionCallslist = [];

    if($function.params.length > 0){
    if (new_safefunctionCallslist.indexOf($function.name) == -1)
        new_safefunctionCallslist.push($function.name);
    }

    if(new_safefunctionCallslist.indexOf($function.name) != -1){
        new_safefunctionCallslist.splice(new_safefunctionCallslist.indexOf($function.name),1);
    }
    
    if(new_safefunctionCallslist.indexOf($function.name) != -1){
        if($arrayAccess.use.indexOf('write') == -1){
            continue;
        }
        //corrigir isto 
        var currentRegion = $arrayAccess.arrayVar.getDescendantsAndSelf('varref')[0].vardecl.currentRegion;
        if(((currentRegion) != undefined && currentRegion.joinPointType == 'file') or ($arrayAccess.arrayVar.getDescendantsAndSelf('varref')[0].vardecl.isParam)){
            new_safefunctionCallslist.splice(new_safefunctionCallslist.indexOf($function.name),1);
        }
        /*
		if (
			$arrayAccess.use.indexOf('write') !== -1 && 
				(
					$arrayAccess.arrayVar.getDescendantsAndSelf('varref')[0].vardecl.currentRegion.joinPointType === 'file'
					||
					$arrayAccess.arrayVar.getDescendantsAndSelf('varref')[0].vardecl.isParam
				)
			)
			new_safefunctionCallslist.splice(new_safefunctionCallslist.indexOf($function.name),1);
*/			
        
}
    if(new_safefunctionCallslist.indexOf($function.name) != -1){
        if($.use.indexOf('write') === -1) {
			continue;
		}
    }

	select file.function.body.memberAccess end
	apply
		if($memberAccess.use.indexOf('write') === -1) {
			continue;
		}
		
		var currentRegion = $memberAccess.getDescendantsAndSelf('varref')[0].vardecl.currentRegion;
		if(currentRegion !== undefined && currentRegion.joinPointType === 'file') {
			new_safefunctionCallslist.splice(new_safefunctionCallslist.indexOf($function.name),1);
		}
		
	/*
		if (
			$memberAccess.use.indexOf('write') !== -1 &&
			$memberAccess.getDescendantsAndSelf('varref')[0].vardecl.currentRegion.joinPointType === 'file'
			)
			new_safefunctionCallslist.splice(new_safefunctionCallslist.indexOf($function.name),1);		
	*/
    


    if(new_safefunctionCallslist.indexOf($function.name) != -1){
        if($varref.useExpr.use.indexOf('write') == -1){
            continue;
        }

        var currentRegion = $varref.vardecl.currentRegion;
        if(currentRegion != undefined && currentRegion.joinPointType == 'file') {
            new_safefunctionCallslist.splice(new_safefunctionCallslist.indexOf($function.name),1);
        }
        /*
		if (
			$varref.useExpr.use.indexOf('write') !== -1 &&
			$varref.vardecl.currentRegion.joinPointType === 'file'
			)
			new_safefunctionCallslist.splice(new_safefunctionCallslist.indexOf($function.name),1);		
		*/
    }
    //nao esta a dar bem ---------------
    $file.insertBegin('//new_safefunctionCallslist : ' + new_safefunctionCallslist.join(' , '));

	if (new_safefunctionCallslist.length > 0)
        new_safefunctionCallslist = new_safefunctionCallslist.concat(new_safefunctionCallslist);
