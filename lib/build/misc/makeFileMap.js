/* graph generator */
  
module.exports = function(flow){
  var fconsole = flow.console;
  var content = [];

  if (flow.options.target == 'file-map')
  {
    fconsole.start('Build file map');

    var nodeCount = flow.files.queue.length;
    var edgeCount = 0;

    // build graph file content
    fconsole.start('Build map.');
    flow.files.queue.forEach(function(file){
      edgeCount += file.linkTo.length;
      content.push(
        '  {\n' + 
        '    "name": ' + name(file) + ',\n' +
        '    "files": [' +
               file.linkTo.map(function(linkTo){
                 return '\n      ' + name(linkTo);
               }).join(',') + '\n' +
        '    ]\n' +
        '  }'
      );
    });

    // out statistic
    fconsole.log('Node count:' + nodeCount);
    fconsole.log('Edge count: ' + edgeCount);
    fconsole.end();

    // remove all files
    fconsole.log('Drop all output files.');
    flow.files.clear();

    // add archive as single result file
    fconsole.log('Add input graph as single result file.');
    flow.files.add({
      type: 'text',
      outputFilename: 'file-map.json',
      outputContent: 
        '[\n' + 
          content.join(',\n') + '\n' +
        ']'
    });
  }
}

module.exports.handlerName = '[misc] Make file map';

var noFilenameSeed = 0;

function escape(str){
  return str
    .replace(/\\/g, '\\')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\"/g, '\\"');
}

function name(file){
  if (file.filename)
    file.graphName = file.relpath;

  if (!file.graphName)
    file.graphName = file.sourceFilename || '[no filename ' + (noFilenameSeed++) + ']';

  return JSON.stringify(file.graphName);
}
