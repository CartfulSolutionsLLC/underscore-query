const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const outPath = '../dist';
const srcPath = 'src';

module.exports = {
  entry: {
    'json-query': './' + srcPath + '/json-query.js',
  },
  resolve: {
    extensions: ['.js'],
  },
  output: {
    path: path.resolve(__dirname, outPath),
    filename: '[name].js',
    libraryTarget: 'commonjs2'
  },
  devtool: 'source-map',
  devServer: {
    open: true,
  },
  module: {
    rules: [
      {
        test: /\.js?$/,
        exclude: /node_modules/,
        use: [{ loader: 'babel-loader' }],
      },
    ],
  },
  plugins: [
    new CleanWebpackPlugin({
      verbose: true,
    }),
  ],
};
