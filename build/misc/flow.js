
var Console = require('./console');

function Flow(){
  this.console = new Console();
  this.startTime = new Date;
}

Flow.prototype = {
  time: function(){
    return new Date - this.startTime;
  }
}

module.exports = Flow;