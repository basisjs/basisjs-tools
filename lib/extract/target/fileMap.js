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

  var content =  [
    '"files":' + JSON.stringify(content),
    '"links":' + JSON.stringify(
      flow.files.links.map(function(link){
        var fn1 = name(link[0], true);
        var fn2 = name(link[1]);
        return fn1 && fn2 ? [fn1, fn2] : null;
      }).filter(Boolean)
    ),
    '"warns":' + JSON.stringify(flow.warns.map(function(warn){
      warn.message = String(warn.message);
      if (warn.file)
        warn.file = flow.files.resolve(warn.file);
      return warn;
    }))
  ];

  if (flow.l10n)
    content.push(
      '"l10n":' + JSON.stringify(flow.l10n.version == 2
        ? getL10nDictionaries(flow)
        : getL10nLocations(flow))
    );

  flow.files.add({
    type: 'text',
    outputFilename: 'file-map.json',
    outputContent: '{\n' + content.join(',\n') + '\n' + '}'
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

function name(file, implicit){
  if (file.filename)
    file.graphName = file.relpath;

  if (file.sourceFilename)
    file.graphName = file.sourceFilename;

  if (!file.graphName && implicit && file.inline && file.htmlFile)
    return file.htmlFile.relpath;

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
      };

    for (var culture in flow.l10n.cultureDictionaries)
    {
      for (var token in flow.l10n.cultureDictionaries[culture][dictionaryName])
      {
        if (!tokens[token])
          tokens[token] = {};

        tokens[token][culture] = flow.l10n.cultureDictionaries[culture][dictionaryName][token];
      }
    }

    result[dictionaryName] = {
      path: '/' + path.relative(flow.options.base, flow.l10n.dictionaries[dictionaryName].path).replace(/\\/g, '/'),
      tokens: tokens
    };
  }
  return result;
}

function getL10nDictionaries(flow){
  var result = {};

  for (var filename in flow.l10n.dictionaries)
  {
    var dict = flow.l10n.dictionaries[filename];
    var file = dict.file;

    var data = {};

    for (var key in dict.tokens)
    {
      var token = dict.tokens[key];
      var refs = [];

      for (var i = 0, ref; ref = token.ref[i]; i++)
        refs.add(ref.file.relpath);

      data[key] = {
        type: token.type,
        implicit: token.implicit,
        files: refs
      };
    }

    result[file.relpath] = data;
  }

  return result;
}
