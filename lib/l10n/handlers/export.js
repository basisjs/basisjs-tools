var path = require('path')

function unixpath(filename){
  return path.normalize(filename).replace(/\\/g, '/');
}

module.exports = function(flow){
  var fconsole = flow.console;
//  console.log(flow.l10n.dictionaries);
//  console.log(flow.l10n.cultureDictionaries);

  var output = {};

  if (flow.l10n.version == 2)
  {
    // clear file queue
    fconsole.log('Drop all output files.');
    flow.files.clear();

    fconsole.log('basis.l10n version 2 is not supported yet');
    return;
  }

  var baseCulture = flow.l10n.baseCulture && flow.l10n.cultureDictionaries[flow.l10n.baseCulture];

  for (var culture in flow.l10n.cultureDictionaries)
  {
    var cultureDicts = flow.l10n.cultureDictionaries[culture];
    var outputContent = [];

    output[culture] = outputContent;

    for (var dictName in cultureDicts)
    {
      var dict = cultureDicts[dictName];
      for (var key in dict)
      {
        //fconsole.log(culture, dictName, path, dict[path]);
        var msgid = baseCulture && baseCulture[dictName] ? baseCulture[dictName][key] : key;
        outputContent.push(
          '#: ' + unixpath(path.relative(flow.options.base, flow.l10n.dictionaries[dictName].path)) + '/' + culture + '.json:' + dictName + ':' + key,
          'msgid ' + JSON.stringify(msgid),
          'msgstr ' + JSON.stringify(dict[key]),
          ''
        );
      }
    }
  }

  // clear file queue
  fconsole.log('Drop all output files.');
  flow.files.clear();

  for (var culture in output)
  {
    var name = culture.split('-')[0];
    var file = flow.files.add({
      type: 'text',
      outputFilename: name + '.pod',
      outputContent: output[culture].join('\n')
    });
    //console.log(file.outputFilename, file.outputContent);
  }
};

module.exports.handlerName = '[l10n] Export';
