import Clava from "@specs-feup/clava/api/clava/Clava.js";
import CodeInserter from "@specs-feup/clava/api/clava/util/CodeInserter.js";
import Io from "@specs-feup/lara/api/lara/Io.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";
import { Loop, Joinpoint, If } from "@specs-feup/clava/api/Joinpoints.js";

/**************************************************************
* 
*                       RemoveNakedloops
* 
**************************************************************/
export function RemoveNakedloops($loops : Loop[],$ifs : If[]) {

    for(var $loop of $loops) {
        if($loop.body.naked == true){
        $loop.body.setNaked(false);
        //$loop.body.insertBefore('{');
        //$loop.body.insertAfter('}');
        }
    }
    
    for(var $if of $ifs) { // parece estar correta a traduçao
        if($if.then.naked == true){
            $if.then.setNaked(false);
        }
    }

    for(var $if of $ifs) { // parece estar correta a traduçao
        if($if.else.naked == true){
            $if.else.setNaked(false);
        }
    }

}