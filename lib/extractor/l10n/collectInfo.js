(module.exports = function(flow){
  if (!flow.l10n.module)
  {
    fconsole.log('Skiped.')
    fconsole.log('basis.l10n not found');
    return;
  }

  var fconsole = flow.console;
  var queue = flow.files.queue;

  var cultureList = flow.l10n.cultureList;
  var defList = flow.l10n.defList;

  var dictionaries = {};
  var nameFile = {};
  var l10nKeys = {};

  //
  // Collect
  //
  fconsole.start('# Collect dictionaries and keys');
  for (var i = 0, entry; entry = defList[i]; i++)
  {
    var name = entry.name;
    var path = entry.path;
    var tokens = entry.keys;
    var file = entry.file;

    fconsole.start(name);

    if (dictionaries[name])
    {
      flow.warn({
        file: file.relpath,
        message: name + ' already declared in ' + nameFile[name].relpath
      });
    }
    else
    {
      nameFile[name] = file;
      dictionaries[name] = path;
    }

    for (var key in tokens)
    {
      if (l10nKeys[name + '.' + key])
      {
        flow.warn({
          file: file.relpath,
          message: 'Duplicate key found: ' + name + '.' + key
        });
      }

      l10nKeys[name + '.' + key] = true;
      dictionaries[name][key] = tokens[key];
    }

    fconsole.end();
  }
  fconsole.endl();

  // extend l10n
  flow.l10n.keys = l10nKeys;
  flow.l10n.dictionaries = dictionaries;


  //
  // Make culture dictionaries
  //
  var cultureDictionaries = {};
  for (var i = 0; culture = cultureList[i]; i++)
    cultureDictionaries[culture] = {};

  // check out pathes and collect culture dictionaries
  fconsole.start('# Collect culture content');
  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'l10n')
    {
      var culture = file.culture;
      var cultureMap = cultureDictionaries[culture];
      var dictPack = null;

      fconsole.start('(' + culture + ') ' + file.relpath);

      try {
        dictPack = JSON.parse(file.content);
      } catch(e) {
        flow.warn({
          file: file.relpath,
          message: 'JSON parse error: ' + (e.message || e)
        });
      }

      if (dictPack)
      {
        for (var dictName in dictPack)
        {
          if (!dictionaries[dictName])
          {
            flow.warn({
              file: file.relpath,
              message: 'Unknown dictionary (ignored): ' + dictName
            });
          }
          else
          {
            if (!cultureMap[dictName])
              cultureMap[dictName] = {};
            else
              flow.warn({
                file: file.relpath,
                message: 'Dictionary ' + dictName + ' was declared before (maybe duplicate?)'
              });

            var inputDict = dictPack[dictName];
            var outputDict = cultureMap[dictName];
            
            for (var inputKey in inputDict)
            {
              var fullpath = dictName + '.' + inputKey;

              if (!l10nKeys[fullpath])
              {
                flow.warn({
                  file: file.relpath,
                  message: 'Unknown key (ignored): ' + fullpath
                });
              }
              else
              {
                if (!outputDict.hasOwnProperty(inputKey))
                  outputDict[inputKey] = inputDict[inputKey];
                else
                  flow.warn({
                    file: file.relpath,
                    message: 'Duplicate key ' + inputKey + ' for ' + dictName + ' ignored'
                  });
              }
            }
          }
        }
      }

      fconsole.endl();
    }
  }
  fconsole.endl();

  // extend l10n
  flow.l10n.cultureDictionaries = cultureDictionaries;

}).handlerName = '[l10n] Collect info';
