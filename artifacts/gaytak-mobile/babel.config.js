module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: [
      [
        "module-resolver",
        {
          root: ["."],
          alias: {
            "@workspace/api-client-react": "./_api_client",
          },
        },
      ],
    ],
  };
};
