var path = require('path');
  
(module.exports = function(flow){
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
          '"warns":' + JSON.stringify(flow.warns),
          '"l10n":' + JSON.stringify(getL10nLocations(flow))
        ].join(',\n') + '\n' +
      '}'
  });
}).handlerName = 'Make file map';

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

  return file.graphName;
}

function getL10nLocations(flow){
  var result = {};
  for (var dictionaryName in flow.l10n.dictionaries)
  {
    var tokens = {};
    for (var token in flow.l10n.dictionaries[dictionaryName].tokens)
      tokens[token] = {
        base: flow.l10n.dictionaries[dictionaryName].tokens[token]
      }

    for (var culture in flow.l10n.cultureDictionaries)
    {
      for (var token in flow.l10n.cultureDictionaries[culture][dictionaryName])
      {
        if (!tokens[token])
          tokens[token] = {}

        tokens[token][culture] = flow.l10n.cultureDictionaries[culture][dictionaryName][token];
      }
    }

    result[dictionaryName] = {
      path: '/' + path.relative(flow.options.base, flow.l10n.dictionaries[dictionaryName].path).replace(/\\/g, '/'),
      tokens: tokens
    }
  }
  return result;
}
