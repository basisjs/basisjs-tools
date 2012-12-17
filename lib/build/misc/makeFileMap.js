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

      if (!name(file))
        return;

      var files = [];
      for (var i = 0; i < file.linkTo.length; i++)
      {
        var resolved = resolveLinkTo(file.linkTo[i]);
        if (resolved)
          files.push.apply(files, resolved.map(function(fn){
            return '\n      ' + fn;
          }));
      }

      content.push(
        '  {\n' + 
        '    "name": ' + name(file) + ',\n' +
        '    "type": "' + file.type + '",\n' +
        '    "files": [' +
               files.join(',') + '\n' +
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

function resolveLinkTo(file){
  var n = name(file);
  if (n)
    return [n];
  else
    return file.linkTo.map(resolveLinkTo).reduce(function(item, res){
      if (item)
        return res.concat(item);
      else
        return res;
    }, []);
}

function name(file){
  if (file.filename)
    file.graphName = file.relpath;

  if (file.sourceFilename)
    file.graphName = file.sourceFilename;

  if (!file.graphName)
    return;//file.graphName = 'no filename' + ++noFilenameSeed;

  return JSON.stringify(file.graphName);
}
