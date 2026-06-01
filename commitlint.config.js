module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'guest-portal',
        'partner-dashboard',
        'admin-console',
        'api-gateway',
        'mobile-app',
        'scanner-app',
        'core',
        'ui',
        'types',
        'functions',
        'infra',
        'ci',
        'deps',
        'docs',
        'root',
      ],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 72],
    'scope-empty': [2, 'never'],
  },
  parserPreset: {
    parserOpts: {
      headerPattern: /^(\w+)\(([\w-]+)\)[-:]\s(.+)$/,
      headerCorrespondence: ['type', 'scope', 'subject'],
    },
  },
};
