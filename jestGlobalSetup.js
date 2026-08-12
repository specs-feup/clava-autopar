import path from "node:path";

import java from "java";
import laraGlobalSetup from "@specs-feup/lara/jest/jestGlobalSetup.js";

export default async function projectGlobalSetup(globalConfig, projectConfig) {
  java.classpath.push(path.resolve("java-binaries", "PetitPlus.jar"));
  await laraGlobalSetup(globalConfig, projectConfig);
}
