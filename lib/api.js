var build = require('basisjs-tools-build');

module.exports = {
  config: require('./config'),
  create: require('./create'),
  server: require('./server'),
  extract: build.extract,
  lint: build.lint,
  build: build.build
};
