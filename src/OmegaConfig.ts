/*
 * Configurations related with Omega framework.
 *
 * @class
 */
export default class OmegaConfig {
    static petitExecutable = null;

    static setPetitExecutable(petitExecutable : any) {
        OmegaConfig.petitExecutable = petitExecutable;
    }
}
