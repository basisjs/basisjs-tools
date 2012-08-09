
var Console = require('./console');
var FileManager = require('./files');

function Flow(options){
  this.startTime = new Date;
  this.options = options;

  this.console = new Console();
  this.files = new FileManager(this.options.base, this.console);  // [base]
}

Flow.prototype = {
  time: function(){
    return new Date - this.startTime;
  }
}

module.exports = Flow;