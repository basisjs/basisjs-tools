
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

function command(command, parse, action){
  var options = apply(!command || command === commander ? commander : commander.command(command), parse);

  if (parse)
    action(options);
  else
    options.action(action);

  return options;
}

function apply(options, parse){
  options
    .version('0.0.1', '-v, --version')
    .description('Launch a http server')

    .option('-b, --base <path>', 'base path for path resolving (current path by default)')
    .option('-p, --port <n>', 'listening port (default 8000)', Number, 8000)

  // parse argv
  if (parse)
    options.parse(process.argv);

  return options;
}

function norm(options){
  options.base = path.normalize(path.resolve('.', options.base) + '/');
  return options;
}
