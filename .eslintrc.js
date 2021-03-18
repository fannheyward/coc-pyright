module.exports = {
  root: true,
  env: {
    node: true,
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    semi: ['error', 'always'],
    quotes: ['error', 'single', {'avoidEscape': true, 'allowTemplateLiterals': true}],
    'no-empty': ['error', { 'allowEmptyCatch': true }],
    'comma-dangle': ['error', 'always-multiline'],
    'max-len': ['error', {'code': 180, 'tabWidth': 2}],
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-namespace': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
  },
};
