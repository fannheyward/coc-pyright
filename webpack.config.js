const path = require('path');

module.exports = {
  entry: './src/index.ts',
  target: 'node',
  mode: 'none',
  resolve: {
    mainFields: ['module', 'main'],
    extensions: ['.js', '.ts']
  },
  externals: {
    'coc.nvim': 'commonjs coc.nvim'
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              compilerOptions: {
                sourceMap: true
              }
            }
          }
        ]
      }
    ]
  },
  output: {
    path: path.join(__dirname, 'lib'),
    filename: 'index.js',
    libraryTarget: 'commonjs'
  },
  plugins: [],
  node: {
    __dirname: false,
    __filename: false
  }
};
