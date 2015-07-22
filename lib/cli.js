var clap = require('clap');
var configure = require('basisjs-tools-config');
var build = require('basisjs-tools-build').cli;
var utils = require('./common/utils');

var program = configure(clap.create('basis'))
  .version(utils.getToolsId(true))
  .action(function(){
    this.showHelp();
  });

//
// registrate commands
//

program.command(require('./completion/command'));
program.command(require('./config/command'));

program.command(build.commands.extract);
program.command(build.commands.build);
program.command(build.commands.lint);
program.command(require('./server/command'));
program.command(require('./create/command'));


//
// export
//

module.exports = {
  run: program.run.bind(program),
  isCliError: function(err){
    return err instanceof clap.Error;
  }
};
