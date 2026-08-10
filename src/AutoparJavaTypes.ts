import JavaTypes, {
  JavaClasses,
} from "@specs-feup/lara/api/lara/util/JavaTypes.js";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace AutoparJavaClasses {
  /* eslint-disable @typescript-eslint/no-empty-object-type */
  export interface ClavaPetit extends JavaClasses.JavaClass {}
  /* eslint-enable @typescript-eslint/no-empty-object-type */
}

/**
 * Static variables with class names of Java classes used in the Autopar API.
 *
 */
export default class AutoparJavaTypes {
  static get ClavaPetit() {
    return JavaTypes.getType(
      "pt.up.fe.specs.clava.weaver.util.ClavaPetit",
    ) as AutoparJavaClasses.ClavaPetit;
  }
}
