module.exports = params => {
  const nodeEnv = params && params.NODE_ENV;

  if (!nodeEnv) {
    throw new Error('"NODE_ENV" environment variable must be provided');
  }

  console.log(
    `🛠️  Running ${nodeEnv} mode using ./webpack/webpack.${nodeEnv}.js 🛠️`,
  );

  return require(`./webpack/webpack.${nodeEnv}.js`);
};
