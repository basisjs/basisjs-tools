
var Console = require('./console');
var FileManager = require('./files');

function Flow(options){
  this.startTime = Date.now();
  this.options = options;

  this.console = new Console();
  this.files = new FileManager(this.options.base, this.console);  // [base]
}

Flow.prototype = {
  time: function(){
    return Date.now() - this.startTime;
  }
}

module.exports = Flow;