const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const CompressionPlugin = require('compression-webpack-plugin');

const isAnalyze = process.env.ANALYZE === 'true';

module.exports = {
  mode: 'production',
  entry: './src/main.jsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash:8].js',
    chunkFilename: '[name].[contenthash:8].chunk.js',
    publicPath: './',
  },
  resolve: {
    extensions: ['.js', '.jsx', '.json', '.mjs', '.cjs'],
    alias: {
      // Ensure React uses production build
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
    mainFields: ['main', 'module']
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|mjs|cjs)$/,
        // Exclude node_modules except for packages that need transpilation
        exclude: /node_modules\/(?!(@mui|@emotion|@babel\/runtime|react-router|react-router-dom|@tanstack|cookie|react-hot-toast)\/).*/,
        use: {
          loader: 'babel-loader',
          options: {
            cacheDirectory: false,
            babelrc: true,
            configFile: path.resolve(__dirname, '.babelrc')
          }
        }
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader'
        ]
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg|webp)$/i,
        use: [
          {
            loader: 'url-loader',
            options: {
              limit: 4096, // Reduced from 8192 to inline only very small files
              name: 'assets/[name].[hash:8].[ext]',
              esModule: false,
            }
          }
        ]
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: 'fonts/[name].[hash:8].[ext]',
              esModule: false,
            }
          }
        ]
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html',
      inject: 'body',
      scriptLoading: 'blocking',
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        removeRedundantAttributes: true,
        useShortDoctype: true,
        removeEmptyAttributes: true,
        removeStyleLinkTypeAttributes: true,
        keepClosingSlash: true,
        minifyJS: true,
        minifyCSS: true,
        minifyURLs: true,
      },
    }),
    new MiniCssExtractPlugin({
      filename: '[name].[contenthash:8].css',
      chunkFilename: '[name].[contenthash:8].chunk.css',
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env': JSON.stringify({}),
      'global': 'globalThis',
    }),
    // Add banner to bundle for debugging
    new webpack.BannerPlugin({
      banner: '/* PanMetro TV App - ES5 Compatible Build for Tizen 5.5+ */',
      raw: true,
      entryOnly: true,
    }),
    // Ignore moment locales to reduce bundle size
    new webpack.IgnorePlugin({
      resourceRegExp: /^\.\/locale$/,
      contextRegExp: /moment$/,
    }),
    // Compression plugin for gzip
    new CompressionPlugin({
      filename: '[path][base].gz',
      algorithm: 'gzip',
      test: /\.(js|css|html|svg)$/,
      threshold: 8192,
      minRatio: 0.8,
    }),
    // Bundle analyzer (only when ANALYZE=true)
    ...(isAnalyze ? [new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      reportFilename: 'bundle-report.html',
      openAnalyzer: true,
    })] : []),
  ],
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          ecma: 5, // Target ES5
          parse: {
            ecma: 8, // Can parse ES8
          },
          compress: {
            ecma: 5,
            warnings: false,
            comparisons: false,
            inline: 2,
            drop_console: false, // Keep console for TV debugging
            drop_debugger: true,
            pure_funcs: ['console.debug', 'console.trace'], // Remove debug logs
            passes: 2, // Run compression twice for better results
            dead_code: true,
            unused: true,
          },
          mangle: {
            safari10: true,
          },
          output: {
            ecma: 5,
            comments: false,
            ascii_only: true,
          },
        },
        parallel: true,
        extractComments: false,
      }),
    ],
    // Enable code splitting for better performance
    splitChunks: {
      chunks: 'all',
      maxInitialRequests: 25,
      minSize: 20000,
      maxSize: 244000, // Try to keep chunks under ~240KB
      cacheGroups: {
        // Vendor chunk for node_modules
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
          reuseExistingChunk: true,
        },
        // React and React-DOM in separate chunk
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
          name: 'react',
          priority: 20,
          reuseExistingChunk: true,
        },
        // MUI and Emotion in separate chunk
        mui: {
          test: /[\\/]node_modules[\\/](@mui|@emotion)[\\/]/,
          name: 'mui',
          priority: 15,
          reuseExistingChunk: true,
        },
        // Shaka Player in separate chunk (it's large)
        shaka: {
          test: /[\\/]node_modules[\\/]shaka-player[\\/]/,
          name: 'shaka',
          priority: 15,
          reuseExistingChunk: true,
        },
        // React Router in separate chunk
        router: {
          test: /[\\/]node_modules[\\/](react-router|react-router-dom)[\\/]/,
          name: 'router',
          priority: 15,
          reuseExistingChunk: true,
        },
        // Common code used across multiple chunks
        common: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
          enforce: true,
        },
      },
    },
    runtimeChunk: {
      name: 'runtime',
    },
    usedExports: true, // Tree shaking
    sideEffects: true, // Respect package.json sideEffects
    concatenateModules: true, // Module concatenation
  },
  // Disable source maps for production
  devtool: false,
  performance: {
    maxEntrypointSize: 512000, // 500KB warning
    maxAssetSize: 512000, // 500KB warning
    hints: 'warning',
  },
  stats: {
    colors: true,
    chunks: true,
    modules: false,
    children: false,
    assets: true,
    entrypoints: true,
  },
  // Ensure compatibility
  target: 'web',
};
