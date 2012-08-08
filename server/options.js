
var path = require('path');
var commander = require('commander');

//
// export
//

module.exports = {
  command: command,
  apply: apply,
  norm: norm
};

//
// main part
//

function command(command, args, action){
  var options = apply(!command || command === commander ? commander : commander.command(command), args);

  action(options);

  return options;
}

function apply(options, args){
  options
    .version('0.0.1', '-v, --version')
    .description('Launch a http server')

    .option('-b, --base <path>', 'base path for path resolving (current path by default)')
    .option('-p, --port <n>', 'listening port (default 8000)', Number, 8000)

  // parse argv
  if (args)
    options.parse(args);

  return options;
}

function norm(options){
  options.base = path.normalize(path.resolve('.', options.base) + '/');
  return options;
}
