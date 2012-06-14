
var path = require('path');
var utils = require('./misc/utils');


var targetFile = '../build.test/index.html';
var targetDir = path.dirname(path.resolve(targetFile)) + '/';

var flowData = {
  buildFile: targetFile,
  baseURI: targetDir,
  buildDir: path.resolve(targetDir, 'build') + '/',

  console: require('./misc/console')
};

var flow = [
  require('./misc/options'),
  require('./misc/files'),

  require('./html/init'),
  require('./js/init'),
  require('./css/init'),

  require('./html/parse'),
  require('./html/fetchFiles'),

  //require('./js/realignHtml'),
  require('./js/parse'),

  require('./tmpl/parse'),

  require('./css/prepareOutput'),
  require('./css/parse'),
  require('./css/buildOutput'),
  require('./css/merge'),
  require('./css/pack'),
  require('./css/write'),

  require('./html/write')
];

flow.forEach(function(handler){
  var title = handler.handlerName;
  var fconsole = flowData.console;

  if (title)
  {
    fconsole.incDeep();
    fconsole.log('\n' + title + '\n' + ('='.repeat(title.length)) + '\n');
  }

  handler(flowData);

  fconsole.resetDeep();
  fconsole.log();
});

/*var map = {};
flowData.files.queue.forEach(function(file){
  if (!map[file.type])
    map[file.type] = [];

  map[file.type].push(file.filename);
})

console.log(map);*/