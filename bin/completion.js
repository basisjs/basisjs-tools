var fs = require('fs');
var path = require('path');

module.exports = function(){
  var argv = process.argv.slice(2);
  
  if (argv.length === 1 && argv[0] === "completion" )
  {
    console.log(fs.readFileSync(__dirname + '/completion.sh', 'utf8'));
    process.exit();
  }
  
  var args = argv.slice(3);
  var index = --process.env.COMP_CWORD;
  var action = args[0];
  var actions = {};//require('../lib/api.js');
  
  if (index === 0)
  {
    console.log(['create', 'build', 'extract', 'server', 'here'].filter(function(a){
      return a.substr(0, action.length) == action;
    }).join('\n'));
  }
  else if (actions[action])
  {
    var module = actions[action];

    if (typeof module.completion === "function")
    {
      module.completion({
        word: args[index],
        index: index,
        args: args
      });
    }
  }
};