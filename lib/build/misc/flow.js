var Console = require('./console');
var FileManager = require('./files');
var chalk = require('chalk');

function Flow(options){
  this.startTime = Date.now();
  this.options = options;
  this.warns = [];

  this.console = new Console();
  this.files = new FileManager(this.options.base, this.console, this);  // [base]
}

Flow.prototype = {
  exitOnFatal: false,

  time: function(){
    return Date.now() - this.startTime;
  },
  warn: function(warn){
    this.warns.push(warn);

    if (warn.fatal)
    {
      var enabled = this.console.enabled;

      this.console.enabled = true;
      this.console.log.apply(this.console, [chalk.red('[FATAL]')].concat(warn.message));
      this.console.enabled = enabled;

      if (this.exitOnFatal)
        process.exit();
    }
    else
    {
      this.console.log.apply(this.console, [chalk.red('[WARN]')].concat(warn.message));
    }
  }
};

module.exports = Flow;
