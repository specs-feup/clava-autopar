import Query from "@specs-feup/lara/api/weaver/Query.js";
import { FunctionJp, Loop } from "@specs-feup/clava/api/Joinpoints.js";
import { foo } from "./foo.js";
import { Parallelize } from "./Parallelize.js";

/*
for (const $function of Query.search(FunctionJp)) {
  console.log($function.name);
}

console.log("Done");
console.log("Also, foo =", foo());
*/

var $loops = [] as Loop[];
for (const $loop of Query.search(FunctionJp, "foo").search(Loop)) {
    $loops.push($loop);
}

Parallelize.forLoops($loops);
