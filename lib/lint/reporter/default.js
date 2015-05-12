module.exports = function(flow){
  var fconsole = flow.console;

  if (flow.warns.length)
  {
    fconsole.start('Warnings (' + flow.warns.length + '):\n');

    var warnByFilename = require('./process-warns.js')(flow);

    Object.keys(warnByFilename).sort().forEach(function(key){
      fconsole.start(key);
      fconsole.list(warnByFilename[key].map(function(w){
        return w.message;
      }));
      fconsole.endl();
    });
  }
  else
    fconsole.log('No warnings found.');
};
