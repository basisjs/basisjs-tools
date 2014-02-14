var path = require('path');
var chalk = require('chalk');

function ralign(str, len){
  while (str.length < len)
    str = ' ' + str;
  return str;
}

function logMsg(topic, message, verbose){
  if (!verbose || module.exports.verbose)
    console.log(chalk.cyan(ralign(topic.toLowerCase(), 9)) + '  ' + chalk.white(message));
}

function logWarn(topic, message){
  console.log(chalk.red(ralign(topic.toLowerCase(), 9)) + '  ' + chalk.white(message));
}

function relPathBuilder(base){
  return function(filename){
    return path.relative(base, path.resolve(base, filename))
      .replace(/\\/g, '/')
      .replace(/^([^\.])/, '/$1');
  }
}

module.exports = {
  verbose: true,
  logMsg: logMsg,
  logWarn: logWarn,
  relPathBuilder: relPathBuilder
};
