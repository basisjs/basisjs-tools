
var utils = require('./misc/utils');

var startTime = new Date();


var flowData = {
  console: require('./misc/console')
};

var flow = [
  require('./misc/options'),
  require('./misc/files'),

  require('./html/init'),
  require('./js/init'),
  require('./css/init'),

  // extract files
  require('./html/parse'),
  require('./html/fetchFiles'),
  require('./tmpl/init'),
  require('./js/parse'),
  require('./tmpl/parse'),
  require('./css/parse'),
  require('./resource/parse'),

  // process css
  require('./css/makePackages'),
  require('./css/linear'),
  require('./css/merge'),
  require('./css/pack'),
  require('./css/translate'),

  // process l10n
  require('./l10n/collect'),
  require('./l10n/modifyCall'),

  // process tmpl
  require('./tmpl/translate'),

  // css/html resources
  require('./resource/translate'),
  require('./resource/buildMap'),

  // process js
  require('./js/relink'),
  require('./js/merge'),
  require('./js/translate'),
  require('./js/makePackages'),

  // process html
  require('./html/translate'),
  
  // flush output
  require('./misc/writeFiles')
];

flow.forEach(function(handler){
  var title = handler.handlerName;
  var fconsole = flowData.console;

  if (title)
  {
    fconsole.incDeep();
    fconsole.log('\n' + title + '\n' + ('='.repeat(title.length)) + '\n');
  }

  var handlerTime = new Date();
  handler(flowData);

  fconsole.resetDeep();
  fconsole.log('');
  fconsole.log('Time: ' + ((new Date - handlerTime) / 1000).toFixed(3) + 's');
});

console.log('\n\nBuild done in ' + ((new Date - startTime) / 1000).toFixed(3) + 's');

/*var map = {};
flowData.files.queue.forEach(function(file){
  if (!map[file.type])
    map[file.type] = [];

  map[file.type].push(file.filename);
})

console.log(map);*/