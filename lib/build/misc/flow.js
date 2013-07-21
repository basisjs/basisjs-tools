
var Console = require('./console');
var FileManager = require('./files');

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

    this.console.log.apply(this.console, [warn.fatal ? '[FATAL]' : '[WARN]'].concat(warn.message));

    if (warn.fatal && this.exitOnFatal)
      process.exit();
  }
};

module.exports = Flow;