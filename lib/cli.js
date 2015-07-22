var cli = require('clap');
var create = require('./config');

var command = cli
  .create('basis')
  .action(function(){
    this.showHelp();
  });

var program = create(command);
program.Error = cli.Error;


//
// registrate commands
//

program.command(require('./completion/command'));
program.command(require('./config/command'));

program.command(require('./extract/command'));
program.command(require('./build/command'));
program.command(require('./lint/command'));
program.command(require('./server/command'));
program.command(require('./create/command'));


//
// export
//

module.exports = program;
