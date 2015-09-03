var clap = require('clap');
var build = require('basisjs-tools-build').cli;
var version = require('./version');

var program = clap.create('basis')
  .extend(require('basisjs-tools-config'))
  .version(version.getToolsId(true))
  .action(function(){
    this.showHelp();
  })
  .delegate(function(nextCommand){
    nextCommand.setOptions(this.values);

    if (nextCommand.name != 'completion' &&
        nextCommand.name != 'find' &&
        nextCommand.name != 'extract' &&
        nextCommand.name != 'lint')
    {
      // check for newer version of basisjs-tools
      // make exeption for some commands:
      // - for `completion` and `find` we need return answer as soon as possible
      //   and upgrade notice is not relevant (as should has clean output)
      // - for `extract` and `lint` output should be clean, otherwise it lead
      //   to errors
      var packageInfo = require('../package.json');
      require('update-notifier')({
        packageName: packageInfo.name,
        packageVersion: packageInfo.version
      }).notify({ defer: false });
    }
  });

//
// registrate commands
//

program.command(require('./completion/command'));
program.command(require('./config/command'));

program.command(build.extract);
program.command(build.find);
program.command(build.lint);
program.command(build.build);
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
