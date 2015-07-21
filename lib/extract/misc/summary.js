var utils = require('../../common/utils');

(module.exports = function(flow){
  var fconsole = flow.console;
  var timing = flow.timing;

  // warnings
  if (flow.warns.length)
  {
    fconsole.start('Warnings (' + flow.warns.length + '):');

    var warnByFilename = {};
    flow.warns.forEach(function(warn){
      var filename = warn.file
        ? warn.file //path.relative(options.base, path.resolve(options.base, warn.file)).replace(/\\/g, '/')
        : '[nofilename]';

      if (!warnByFilename[filename])
        warnByFilename[filename] = [];
      warnByFilename[filename].push(String(warn.message));
    });

    Object.keys(warnByFilename).sort().forEach(function(key){
      fconsole.start(key);
      fconsole.list(warnByFilename[key]);
      fconsole.endl();
    });

    fconsole.endl();
  }
  else
    fconsole.log('No warnings\n');

  // timing
  fconsole.start('Timing:');
  timing.forEach(function(t){
    var time = String(t.time || 0);
    fconsole.log(utils.repeat(' ', 6 - time.length) + time + '  ' + (t.name || '[No title step]'));
  });
  fconsole.endl();

  // total time
  fconsole.log('Extract done in ' + (flow.time() / 1000).toFixed(3) + 's');
}).handlerName = 'Summary';
