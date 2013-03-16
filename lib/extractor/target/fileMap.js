/* graph generator */
  
module.exports = function(flow){
  var fconsole = flow.console;
  var content = [];
  var nodeCount = flow.files.queue.length;
  var edgeCount = 0;

  // build graph file content
  fconsole.start('Build map:');
  flow.files.queue.forEach(function(file){
    edgeCount += file.linkTo.length;

    if (!name(file))
      return;

    /*var files = [];
    for (var i = 0; i < file.linkTo.length; i++)
    {
      var resolved = resolveLinkTo(file.linkTo[i]);
      if (resolved)
        files.push.apply(files, resolved.map(function(fn){
          return '\n      ' + fn;
        }));
    }*/

    content.push({
      type: file.type,
      name: name(file)
    });
  });

  // out statistic
  fconsole.log('Node count: ' + nodeCount);
  fconsole.log('Edge count: ' + edgeCount);
  fconsole.endl();

  // remove all files
  fconsole.log('Drop all output files.');
  flow.files.clear();

  // add archive as single result file
  fconsole.log('Add input graph as single result file.');
  flow.files.add({
    type: 'text',
    outputFilename: 'file-map.json',
    outputContent: 
      '{\n' +
        [
          '"files":' + JSON.stringify(content),
          '"links":' + JSON.stringify(
            flow.files.links.map(function(link){
              var fn1 = name(link[0]);
              var fn2 = name(link[1]);
              return fn1 && fn2 ? [ link[0].relpath, link[1].relpath] : null;
            }).filter(Boolean)
          ),
          '"warns":' + JSON.stringify(flow.warns)
        ].join(',\n') + '\n' +
      '}'
  });
}

module.exports.handlerName = 'Make file map';

var noFilenameSeed = 0;

function escape(str){
  return str
    .replace(/\\/g, '\\')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\"/g, '\\"');
}

function resolveLinkTo(link){
  var n = name(link[0]);
  if (n)
    return [n];
  else
    return link[0].linkTo.map(resolveLinkTo).reduce(function(item, res){
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

  return file.graphName;
}
