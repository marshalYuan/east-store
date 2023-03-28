module.exports = {
  "testEnvironment": "node",
  "roots": [
    "<rootDir>"
  ],
  testMatch: [
    "**/__tests__/*.+(ts|tsx|js)",
    "**/?(*.)+(spec|test).+(ts|tsx|js)"
  ],
  testPathIgnorePatterns: [
    "/examples/"
  ],
  "transform": {
    "^.+\\.(ts|tsx)?$": "ts-jest"
  },
  fakeTimers: {
    "legacyFakeTimers": true,
  },
}