module.exports = function (api) {
  const isProduction = api.env('production');

  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    plugins: [
      ...(isProduction ? ['babel-plugin-transform-remove-console'] : []),
      'react-native-reanimated/plugin',
    ],
  };
};
