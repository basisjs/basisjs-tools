var path = require('path');
var chalk = require('chalk');
var toolsPath = path.resolve(__dirname + '/../../..');

function ralign(str, len){
  while (str.length < len)
    str = ' ' + str;
  return str;
}

function buildLogMsg(topic, message){
  return chalk.cyan(ralign(topic.toLowerCase(), 8)) + '  ' + chalk.white(message);
}

function logMsg(topic, message, verbose){
  if (!verbose || module.exports.verbose)
    console.log(buildLogMsg(topic, chalk.white(message)));
}

function logWarn(topic, message){
  console.warn(buildLogMsg(topic, chalk.bgRed.white('WARN') + ' ' + chalk.white(message)));
}

function logError(topic, message){
  console.error(buildLogMsg(topic, chalk.bgRed.white('ERROR') + ' ' + chalk.white(message)));
}

function relPathBuilder(base){
  var cache = {};
  return function(filename){
    if (cache[filename])
      return cache[filename];

    var resolvedFilename = path.resolve(base, filename);
    var toolsRelativePath = path.relative(toolsPath, resolvedFilename);

    if (toolsRelativePath.charAt(0) != '.' &&
        toolsRelativePath.indexOf(':') == -1 &&
        /^(lib|node_modules)/.test(toolsRelativePath))
      return cache[filename] = 'basisjs-tools:' + toolsRelativePath.replace(/\\/g, '/');

    return cache[filename] = path.relative(base, filename)
      .replace(/\\/g, '/')
      .replace(/^([^\.])/, '/$1');
  };
}

/**
* Generates unique id.
* random() + performance.now() + Date.now()
* @param {number=} len Required length of id (16 by default).
* @returns {string} Generated id.
*/
function genUID(len){
  function base36(val){
    return parseInt(Number(val), 10).toString(36);
  }

  var result = (global.performance ? base36(global.performance.now()) : '') + base36(new Date);

  if (!len)
    len = 16;

  while (result.length < len)
    result = base36(1e12 * Math.random()) + result;

  return result.substr(result.length - len, len);
}

module.exports = {
  verbose: true,
  logMsg: logMsg,
  logWarn: logWarn,
  logError: logError,
  relPathBuilder: relPathBuilder,
  genUID: genUID
};
