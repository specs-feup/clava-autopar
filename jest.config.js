import { weaverConfig } from "@specs-feup/clava/code/WeaverConfiguration.js";

const config = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "@specs-feup/lara/jest/jestEnvironment.js",
  testEnvironmentOptions: {
    weaverConfig,
  },
  globalSetup: "./jestGlobalSetup.js",
  globalTeardown: "@specs-feup/lara/jest/jestGlobalTeardown.js",
  setupFiles: ["@specs-feup/lara/jest/setupFiles/sharedJavaModule.js"],
  transform: {
    "^.+\\.m?tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "./tsconfig.jest.json",
      },
    ],
  },
  // Lara publishes its Jest helpers as TypeScript, so they must not be skipped
  // by Jest's default node_modules transform exclusion.
  transformIgnorePatterns: ["/node_modules/(?!@specs-feup/lara/jest/)"],
  //notify: true,
  //notifyMode: "always",
  //verbose: true,
  collectCoverage: false,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"],
  collectCoverageFrom: ["src/**/*[^.d].(t|j)s"],
  coverageProvider: "v8",
  moduleNameMapper: {
    "(.+)\\.js": "$1",
  }
};

export default config;
