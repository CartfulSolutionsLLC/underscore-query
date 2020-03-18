const DISABLED = 0;
const WARNING = 1;
const ERROR = 2;

module.exports = {
  env: {
    browser: true,
    node: true
  },
  parser: 'babel-eslint', // Specifies the ESLint parser
  extends: [
    'eslint:recommended', // Uses the recommended rules
    'plugin:prettier/recommended', // Enables eslint-plugin-prettier and displays prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
  ],
  rules: {
    // Place to specify ESLint rules. Can be used to overwrite rules specified from the extended configs
    // 'no-unused-expressions': DISABLED
    "prefer-rest-params": WARNING,
  },
};
