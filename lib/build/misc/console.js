
module.exports = Console;

var slice = Array.prototype.slice;
var push = Array.prototype.push;

function output(con, args){
  if (con.enabled)
    console.log.apply(console, args);
}

function Console(){
  var logDeep = 0;
  var logBuffer = [];

  return {
    enabled: true,

    log: function(){
      var args = slice.call(arguments);

      if (logDeep)
        args.unshift(new Array(logDeep + 1).join('  ').substr(1));

      if (logBuffer.length)
        logBuffer[logBuffer.length - 1].push(args);
      else
        output(this, args);
    },

    list: function(list, prefix){
      if (Array.isArray(list))
        list.forEach(function(line){
          this.log(prefix || '*', line);
        }, this);
      else
        this.log('console.log: list is not an array', list);
    },

    incDeep: function(deep){
      logDeep += deep || 1;
    },
    decDeep: function(deep){
      logDeep = Math.max(0, logDeep - (deep || 1));
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
          output(this, args);
        });
    },
    flushAll: function(){
      while (logBuffer.length)
        this.flush(this.pop());

      logDeep = 0;
    }
  };
}