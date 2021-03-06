/**
 * MIT License
 *
 * Copyright (c) 2017-present, Elasticsearch BV
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

const { Server } = require('karma')
const { EnvironmentPlugin } = require('webpack')
const { getWebpackEnv, getSauceConnectOptions } = require('./test-config')

const BABEL_CONFIG_FILE = require.resolve('elastic-apm-js-base/babel.config.js')

const baseLaunchers = {
  SL_CHROME: {
    base: 'SauceLabs',
    browserName: 'chrome',
    version: '62'
  },
  SL_CHROME46: {
    base: 'SauceLabs',
    browserName: 'chrome',
    version: '46'
  },
  SL_FIREFOX: {
    base: 'SauceLabs',
    browserName: 'firefox',
    version: '42'
  },
  SL_SAFARI9: {
    base: 'SauceLabs',
    browserName: 'safari',
    platform: 'OS X 10.11',
    version: '9.0'
  },
  SL_IE11: {
    base: 'SauceLabs',
    browserName: 'internet explorer',
    platform: 'Windows 8.1',
    version: '11'
  },
  SL_IE10: {
    base: 'SauceLabs',
    browserName: 'internet explorer',
    platform: 'Windows 2012',
    version: '10'
  },
  SL_EDGE: {
    base: 'SauceLabs',
    browserName: 'microsoftedge',
    platform: 'Windows 10',
    version: '13'
  },
  'SL_ANDROID4.4': {
    base: 'SauceLabs',
    browserName: 'android',
    platform: 'Linux',
    version: '4.4'
  },
  SL_ANDROID: {
    base: 'SauceLabs',
    browserName: 'android',
    platform: 'Linux',
    version: '5.0'
  },
  SL_IOS9: {
    base: 'SauceLabs',
    deviceName: 'iPhone Simulator',
    deviceOrientation: 'portrait',
    platformVersion: '9.3',
    platformName: 'iOS',
    browserName: 'Safari'
  }
}

const specPattern = 'test/{*.spec.js,!(e2e)/*.spec.js}'
const { tunnelIdentifier } = getSauceConnectOptions()

/**
 * Common base config for all the mono repo packages
 */
const baseConfig = {
  exclude: ['e2e/**/*.*'],
  files: [specPattern],
  frameworks: ['jasmine'],
  preprocessors: {
    [specPattern]: ['webpack', 'sourcemap']
  },
  plugins: [
    'karma-sauce-launcher',
    'karma-failed-reporter',
    'karma-jasmine',
    'karma-spec-reporter',
    'karma-webpack',
    'karma-sourcemap-loader'
  ],
  webpack: {
    mode: 'none',
    module: {
      rules: [
        {
          test: /\.js$/,
          loader: 'babel-loader',
          options: {
            configFile: BABEL_CONFIG_FILE,
            plugins: []
          }
        }
      ]
    },
    plugins: [new EnvironmentPlugin(getWebpackEnv())],
    devtool: 'inline-source-map'
  },
  webpackMiddleware: {
    stats: 'errors-only'
  },
  browserNoActivityTimeout: 120000,
  customLaunchers: baseLaunchers,
  browsers: [],
  captureTimeout: 120000, // on saucelabs it takes some time to capture browser
  reporters: ['spec', 'failed'],
  sauceLabs: {
    testName: 'ApmJs',
    startConnect: false,
    recordVideo: false,
    recordScreenshots: true,
    tunnelIdentifier,
    options: {
      seleniumVersion: '2.48.2',
      commandTimeout: 600,
      idleTimeout: 600,
      maxDuration: 5400
    }
  }
}

function prepareConfig(defaultConfig) {
  const testConfig = defaultConfig.testConfig || {}
  const agentConfig = defaultConfig.globalConfigs.agentConfig || {}
  const { isTravis, sauceLabs: isSauce } = testConfig
  const { agentName, agentVersion } = agentConfig
  let buildId = `ApmJs-${agentName}@${agentVersion}`

  if (isTravis) {
    buildId =
      buildId +
      ' - TRAVIS #' +
      process.env.TRAVIS_BUILD_NUMBER +
      ' (' +
      process.env.TRAVIS_BUILD_ID +
      ')'
    defaultConfig.plugins.push('karma-firefox-launcher')
    defaultConfig.browsers.push('Firefox')
  } else {
    defaultConfig.plugins.push('karma-chrome-launcher')
    defaultConfig.browsers.push('Chrome')

    if (defaultConfig.coverage) {
      // istanbul code coverage
      defaultConfig.plugins.push('karma-coverage')

      var babelPlugins = defaultConfig.webpack.module.rules[0].options.plugins
      babelPlugins.push('istanbul')

      defaultConfig.coverageReporter = {
        includeAllSources: true,
        reporters: [
          { type: 'html', dir: 'coverage/' },
          { type: 'text-summary' }
        ],
        dir: 'coverage/'
      }
      defaultConfig.reporters.push('coverage')
    }
  }

  if (isSauce) {
    defaultConfig.concurrency = 3
    if (testConfig.branch === 'master') {
      // && process.env.TRAVIS_PULL_REQUEST !== 'false'
      defaultConfig.sauceLabs.build = buildId
      defaultConfig.sauceLabs.tags = ['master']
      console.log('saucelabs.build:', buildId)
    }
    defaultConfig.reporters = ['dots', 'saucelabs']
    defaultConfig.browsers = Object.keys(defaultConfig.customLaunchers)
    defaultConfig.transports = ['polling']
  }

  return defaultConfig
}

function singleRunKarma(configFile, done) {
  new Server(
    {
      configFile,
      singleRun: true
    },
    done
  ).start()
}

module.exports = {
  prepareConfig,
  baseConfig,
  baseLaunchers,
  singleRunKarma
}
