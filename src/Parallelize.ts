/*
import clava.autopar.InlineFunctionCalls;
import clava.autopar.RemoveNakedloops;
import clava.autopar.NormalizedBinaryOp;
import clava.autopar.ParallelizeLoop;
import clava.autopar.AddPragmaLoopIndex;
import clava.autopar.RunInlineFunctionCalls;
import clava.autopar.LoopInductionVariables;
import clava.autopar.CheckForSafeFunctionCall;
import clava.autopar.AutoParStats;
*/
import Clava from "@specs-feup/clava/api/clava/Clava.js";
import CodeInserter from "@specs-feup/clava/api/clava/util/CodeInserter.js";
import Io from "@specs-feup/lara/api/lara/Io.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";
import { Loop, Joinpoint, If, BinaryOp} from "@specs-feup/clava/api/Joinpoints.js";
import { AddPragmaLoopIndex } from "./AddPragmaLoopIndex.js";
import { RemoveNakedloops } from "./RemovedNakedLoops.js";
import { NormalizedBinaryOp } from "./NormalizedBinaryOp.js";

/**
 * Utility methods for parallelization.
 *
 * @class
 */
export class Parallelize {
  static forLoops($loops: Loop[]) {
	var autoparResult = Parallelize.getForLoopsPragmas($loops, true);
	var parallelLoops = autoparResult["parallelLoops"];
	var unparallelizableLoops = autoparResult["unparallelizableLoops"];

    console.log("Parallelization finished");
  }

  static getForLoopsPragmas ($loops: Loop[], $insertPragma: boolean = false, $useLoopId: boolean = false) {

	// Reset stats
	//Parallelize.resetStats();
	
	// Initialize loops if undefined
	if($loops === undefined) {
		$loops = Clava.getProgram().getDescendants('loop') as Loop[];
	}
	$ifs = Clava.getProgram().getDescendants('if') as If[];

	// Filter any loop that is not a for loop
	var $forLoops = [] as Loop[];
	var $ifs = [] as If[];
	for(var $loop of $loops) {
		if($loop.kind !== "for") 
			continue;
		$forLoops.push($loop);
	}
	var $binaryOps = [] as BinaryOp[];
	for (const $op of Query.search(BinaryOp)) {
		$binaryOps.push($op);
	  }
	
	// Save the current AST, before applying modifications that help analysis
	Clava.pushAst();

	
	// Mark all for loops with pragmas
	for(var $originalLoop of $forLoops) {
		if($originalLoop.kind !== "for") {
			continue;
		}
		
		var $loop = Clava.findJp($originalLoop) as Loop;
	
		$loop.insertBefore(`#pragma parallelize_id ${$originalLoop.astId}`);

	}


	// Transformations to help analysis    
	RemoveNakedloops($loops, $ifs);
	AddPragmaLoopIndex($forLoops);
	RunInlineFunctionCalls();

	// Rebuild tree	
	Clava.rebuild();
	
	LoopInductionVariables();
	CheckForSafeFunctionCall();
	RemoveNakedloops($loops, $ifs);
 	NormalizedBinaryOp($binaryOps);

 	// Rebuild tree	
	Clava.rebuild();
	
	
	// Write stats before attempting parallelization
	AutoParStats.save();
	
    console.log('Parallelizing ' + $forLoops.length + ' for loops...');

	// Find all loops marked for parallelization
	//var loopPragmas = {};
	var parallelLoops = {} as Loop[];
	var unparallelizableLoops = {} as Loop[];	
	
	var $pragmas = Clava.getProgram().getDescendants('pragma');
	for(var $pragma of $pragmas) {
		if($pragma.name !== "parallelize_id") {
			continue;
		}

		var parallelization = ParallelizeLoop($pragma.target);
	}

	// Revert AST changes
	Clava.popAst();
	
	var loopIds = [];
	for (var $loop of $loops) {
		loopIds.push($loop.id);
	}
	
	for(var $loop of Query.search('loop').get()) {
	//select file.function.loop end
	//apply
		var loopindex = GetLoopIndex($loop);
		if 	(OmpPragmas[loopindex] !== undefined && loopIds.includes($loop.id))
		{
			if(insertPragma) {
				$loop.insert before OmpPragmas[loopindex].pragmaCode;
			}

		//	parallelLoops[$pragma.content] = OmpPragmas[loopindex].pragmaCode;
			var pragmaCode = OmpPragmas[loopindex].pragmaCode;
			var loopId = useLoopId ? $loop.id : $loop.astId;
			if(pragmaCode.startsWith("#pragma")) {
				parallelLoops[loopId] = pragmaCode;			
			} else {
				unparallelizableLoops[loopId] = pragmaCode;
			}

		}

	//end
	}

	//Clava.rebuild();


	var result = {};
	result["parallelLoops"] = parallelLoops;
	result["unparallelizableLoops"] = unparallelizableLoops;
	
	return result;
	
}	

}

/*
var Parallelize = {};
var OmpPragmas = {};
*/
/**
 * @param $loops {$loop[]} an array of for loops to attempt to parallelize. If undefined, tries to parallelize all for loops in the program.
 */
/*
Parallelize.forLoops = function($loops) {

	//var parallelLoops = Parallelize.getForLoopsPragmas($loops);
	var autoparResult = Parallelize.getForLoopsPragmas($loops, true);
	var parallelLoops = autoparResult["parallelLoops"];
	var unparallelizableLoops = autoparResult["unparallelizableLoops"];

	
    console.log('Parallelization finished');    
}
*/

/**
 *
 */
/*
Parallelize.forLoopsAsText = function($loops, outputFolder) {

	if(outputFolder === undefined) {
		outputFolder = Io.getPath("./");
	}

	var autoparResult = Parallelize.getForLoopsPragmas($loops, true);
	var parallelLoops = autoparResult["parallelLoops"];
	var unparallelizableLoops = autoparResult["unparallelizableLoops"];

	var codeInserter = new CodeInserter();
	var filesWithPragmas = {};
	
	// Add pragmas to loops
	for(var $loop of $loops) 
	{
		var ompPragma = parallelLoops[$loop.astId];
		if(ompPragma === undefined)
		{
			//console.log("Could not parallelize loop@"+$loop.location+":\n -> " + unparallelizableLoops[$loop.astId]);
			continue;
		}


		var $file = $loop.getAncestor("file");
		if($file === undefined)
		{
			console.log("Could not find a file associated with loop@"+$loop.location);
			continue;
		}
		
		codeInserter.add($file, $loop.line, ompPragma);
		
		// Add file
		filesWithPragmas[$file] = true;
	}
	
	// Add includes to files that have pragmas
	for(var $file in filesWithPragmas) {
		codeInserter.add($file, 1, "#include <omp.h>");
	}
	
	codeInserter.write(outputFolder);
	
    console.log('Parallelization finished');    	
}
*/

/**
 *
 * @param {$loop[]} [$loops=<All program loops>] - Array of loops to parallelize.
 * @param {boolean} insertPragma - If true, inserts the found pragmas in the code.
 * @param {boolean} useLoopId - If true, the returning map uses $loop.id instead of $loop.astId as keys.
 *
 * @return {Object[parallelLoops, unparallelizableLoops]} an object with the pragmas of the parallelized loops, and the error messages of the loops that could not be parallelized.
 */



/**
 * Comments OpenMP pragmas that are nested inside other OpenMP pragmas.
 *
 * @return {String} the loop ids of loops whose OpenMP pragmas where commented.
 */
/*
Parallelize.removeNestedPragmas = function() {

	var pragmasToComment = [];
	var commentedLoopIds = [];	
    
	for(var $omp of Query.search("omp")) {
        if(Parallelize.isNestedOpenMP($omp)) {
            pragmasToComment.push($omp);
			commentedLoopIds.push($omp.target.id);
        }
	}
    
    for(var $pragma of pragmasToComment) {
        $pragma.replaceWith("// " + $pragma.code);
    }

	return commentedLoopIds;
}


Parallelize.isNestedOpenMP = function($omp) {
    
    // Check if OpenMP pragma is inside a loop with another OpenMP pragma
    var $loop = $omp.target;
        
    var $ancestor = $loop.parent;
    while($ancestor !== undefined) {
        if($ancestor.instanceOf("loop")) {
            for(var $pragma of $ancestor.pragmas) {
                if($pragma.instanceOf("omp")) {
                    return true;
                }                
            }
        }
        
        $ancestor = $ancestor.parent;
    }

    return false;
}
	*/
