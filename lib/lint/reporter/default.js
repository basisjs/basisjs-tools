module.exports = function(flow){
  if (flow.warns.length)
  {
    var fconsole = flow.console;

    fconsole.start('Warnings (' + flow.warns.length + '):\n');

    var warnByFilename = require('./process-warns.js')(flow);

    Object.keys(warnByFilename).sort().forEach(function(key){
      fconsole.start(key);
      fconsole.list(warnByFilename[key].map(String));
      fconsole.endl();
    });
  }
  else
    fconsole.log('No warnings\n');
};
