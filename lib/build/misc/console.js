
module.exports = Console;

var slice = Array.prototype.slice;
var push = Array.prototype.push;

function Console(){
  var logDeep = 0;
  var logBuffer = [];

  return {
    log: function(){
      var args = slice.call(arguments);

      if (logDeep)
        args.unshift(new Array(logDeep + 1).join('  ').substr(1));

      if (logBuffer.length)
        logBuffer[logBuffer.length - 1].push(args);
      else
        console.log.apply(console, args);
    },

    list: function(list, prefix){
      if (Array.isArray(list))
        list.forEach(function(line){
          this.log(prefix || '*', line);
        }, this);
      else
        this.log('console.log: list is not an array', list);
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

    start: function(){
      this.log.apply(this, arguments);
      this.incDeep();
    },
    end: function(){
      this.decDeep();
    },
    endl: function(){
      this.decDeep();
      this.log();
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