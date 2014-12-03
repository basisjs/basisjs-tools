var clap = require('clap');
var chalk = require('chalk');

module.exports = clap.create('config', '[name] [value]')
  .description('Global configuration')
  .action(function(args){
    var globalConfig = this.context.globalConfig;

    if (!globalConfig)
    {
      console.error('Global config is not available');
      process.exit(1);
    }

    if (args.length == 0)
    {
      console.log(JSON.stringify(globalConfig.values, null, 2));
      return;
    }

    var name = args[0];
    if (args.length == 1)
    {
      // read
      console.log('Config value for ' + name + ' is ' + JSON.stringify(globalConfig.get(name)));
    }
    else
    {
      // write
      console.log('Set value ' + chalk.green(JSON.stringify(args[1])) + ' for ' + chalk.green(name));
      globalConfig.set(name, args[1]);
    }
  });
