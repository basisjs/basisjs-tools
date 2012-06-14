
module.exports = function(flowData){
  var logDeep = 0;
  var logBuffer = [];

  var slice = Array.prototype.slice;
  var push = Array.prototype.push;

  flowData.console = {
    log: function(){
      var args = slice.call(arguments);

      if (logDeep)
        args.unshift(new Array(logDeep + 1).join('  ').substr(1));

      if (logBuffer.length)
        logBuffer[logBuffer.length - 1].push(args);
      else
        console.log.apply(console, args);
    },
    incDeep: function(){
      logDeep++;
    },
    decDeep: function(){
      if (logDeep > 0)
        logDeep--;
    },
    resetDeep: function(){
      logDeep = 0;
    },
    push: function(){
      logBuffer.push([]);
    },
    pop: function(){
      return logBuffer.pop();
    },
    flush: function(messages){
      if (logBuffer.length)
        push.apply(logBuffer[logBuffer.length - 1], messages);
      else
        messages.forEach(function(args){
          console.log.apply(console, args);
        });
    },
    flushAll: function(){
      while (logBuffer.length)
        this.flush(this.pop());

      logDeep = 0;
    }
  };
}