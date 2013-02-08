
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

function command(args, config, action){
  var command = apply(commander.command('create'));

  if (config)
  {
  }

  command.parse(args || process.argv);
  action(command);

  return command;
}

function hasOption(command, name){
  for (var i = 0, option; option = command.options[i]; i++)
    if (name == option.name().replace(/-([a-z])/ig, function(m, l){ return l.toUpperCase(); }))
      return true;
}

function apply(command){
  var starIndex = 0;
  return command
    .description('Set BASISJS_PATH for current directory if on basis.js git repo, or clone basis.js to current location from github.com')

    .usage('basis here');
}

function norm(options){

  return options;
}
