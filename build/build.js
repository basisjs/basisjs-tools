
var utils = require('./misc/utils');
var Flow = require('./misc/flow');

var startTime = new Date();
var flowData = new Flow(require('./options'));

var flow = [
  require('./html/init'),

  // extract files
  require('./html/parse'),
  require('./html/fetchFiles'),
  require('./js/extract'),
  require('./tmpl/extract'),
  require('./css/extract'),
  require('./res/extract'),

  // process css
  require('./css/makePackages'),
  require('./css/linear'),
  require('./css/merge'),
  require('./css/pack'),
  require('./css/translate'),

  // process l10n
  require('./l10n/init'),
  require('./l10n/collect'),
  require('./l10n/buildIndex'),
  require('./l10n/makePackages'),
  require('./l10n/pack'),
  require('./l10n/modifyCall'),

  // process tmpl
  require('./tmpl/translate'),

  // css/html resources
  require('./res/translate'),
  require('./res/buildMap'),

  // process js
  require('./js/relink'),
  require('./js/merge'),
  require('./js/translate'),
  require('./js/makePackages'),
  require('./js/realignHtml'),

  // process html
  require('./html/translate'),
  
  // flush output
  require('./misc/writeFiles')
];

var fconsole = flowData.console;
var times = [];

flow.forEach(function(handler){
  var title = handler.handlerName;

  if (title)
    fconsole.log('\n' + title + '\n' + ('='.repeat(title.length)) + '\n');

  fconsole.incDeep();

  var handlerTime = new Date();
  handler(flowData);
  var elapsedTime = (new Date - handlerTime);

  fconsole.resetDeep();

  fconsole.log('');
  fconsole.log('Time: ' + (elapsedTime / 1000).toFixed(3) + 's');

  // save time
  times.push([elapsedTime, title]);
});

//
// show totals
//

fconsole.log('\nBuild stat\n==========\n');
fconsole.incDeep();

// file types
fconsole.log('File stat:');
fconsole.incDeep();

var fileTypeMap = {};
flowData.files.queue.forEach(function(file){
  if (!this[file.type])
    this[file.type] = [];

  this[file.type].push(file.filename);
}, fileTypeMap);
           
for (var key in fileTypeMap)
  fconsole.log(key + ': ' + fileTypeMap[key].length);

fconsole.decDeep();
fconsole.log('');

// timing
fconsole.log('Timing:');
fconsole.incDeep();
for (var i = 0; i < times.length; i++)
{
  var t = String(times[i][0]);
  fconsole.log(' '.repeat(5 - t.length) + t + '  ' + (times[i][1] || '[No title step]'));
}
fconsole.decDeep();
fconsole.log('');

// total time
fconsole.log('Build done in ' + (flowData.time() / 1000).toFixed(3) + 's');