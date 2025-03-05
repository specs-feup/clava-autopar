import { Loop, If } from "@specs-feup/clava/api/Joinpoints.js";


export function RemoveNakedloops($loops : Loop[],$ifs : If[]) {

    for(var loop of $loops) {
        if(loop.body.naked === true){
            loop.body.setNaked(false);
        }
    }

    for(var $if of $ifs) {
        if($if.then.naked === true){
            $if.then.setNaked(false);
        }
    }

    for(var $if of $ifs) {
        if($if.else.naked === true){
            $if.else.setNaked(false);
        }
    }

}
