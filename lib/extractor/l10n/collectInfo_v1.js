var tmplAt = require('../../ast').tmpl;
var path = require('path');

function resolveDict(flow, filename){
  if (path.extname(filename) != '.l10n')
    filename = path.dirname(filename) + '/' + path.basename(filename, path.extname(filename)) + '.l10n';

  var dictionary = flow.l10n.dictList[filename];

  if (!dictionary)
  {
    var file = flow.files.add({
      jsRefCount: 0,
      filename: filename
    });
    file.isResource = true;

    dictionary = flow.l10n.dictList[filename] = {
      file: file,
      tokens: [],
      usedTokens: {}
    };
  }

  return dictionary;
}

module.exports = function(flow){
  var fconsole = flow.console;
  var queue = flow.files.queue;

  var cultureList = flow.l10n.cultureList;
  var defList = flow.l10n.defList;
  var getTokenList = flow.l10n.getTokenList;

  var dictionaries = {};
  var nameFile = {};
  var l10nKeys = {};

  // Todo: remove

  basis.require('basis.l10n');

  //
  // Collect template l10n pathes
  //
  var l10nPrefix = /^l10n:/;
  var tmplRefs = [];

  fconsole.start('# Collect keys in templates (v1)');
  flow.files.queue.forEach(function(file){
    if (file.type == 'template')
    {
      fconsole.start(file.relpath);

      tmplAt.walk(file.ast, {
        text: function(token){
          var bindName = token[1];
          if (l10nPrefix.test(bindName))
          {
            var l10nTokenRef = bindName.substr(5);
            var l10nToken = basis.l10n.token(l10nTokenRef);
            var l10nTokenName = l10nToken.dictionary.name + '.' + l10nToken.name;

            if (bindName != l10nTokenName)
              fconsole.log(bindName, '->', l10nTokenName);
            else
              fconsole.log(bindName);

            tmplRefs.push({
              file: this.file,
              name: l10nTokenName,
              key: l10nTokenRef,
              host: token,
              idx: 1
            });
          }
        },
        attr: function(token){
          var attrName = this.tokenName(token);
          if (token[1] && token[0] == 2 && attrName != 'class' && attrName != 'style')
            for (var i = 0, bindings = token[1][0], bindName; bindName = bindings[i]; i++)
              if (l10nPrefix.test(bindName))
              {
                var l10nTokenRef = bindName.substr(5);
                var l10nToken = basis.l10n.token(l10nTokenRef);
                var l10nTokenName = l10nToken.dictionary.name + '.' + l10nToken.name;

                if (bindName != l10nTokenName)
                  fconsole.log(bindName, '->', l10nTokenName);
                else
                  fconsole.log(bindName);

                tmplRefs.push({
                  file: this.file,
                  name: l10nTokenName,
                  key: l10nTokenRef,
                  host: bindings,
                  idx: i
                });
              }
        }
      }, { file: file });

      fconsole.endl();
    }
  });
  fconsole.endl();
  
  // extend l10n
  flow.l10n.tmplRefs = tmplRefs;

  //
  // Collect
  //
  fconsole.start('# Collect dictionaries and keys');
  for (var i = 0, entry; entry = defList[i]; i++)
  {
    var name = entry.name;
    var dictpath = entry.path;
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
      dictionaries[name] = {
        path: dictpath,
        tokens: {}
      }
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
      dictionaries[name].tokens[key] = tokens[key];
    }

    fconsole.end();
  }
  fconsole.endl();

  // extend l10n
  flow.l10n.keys = l10nKeys;
  flow.l10n.dictionaries = dictionaries;


  //
  // Validate getToken
  //
  fconsole.start('Validate getToken paths');
  for (var i = 0, entry; entry = getTokenList[i]; i++)
    if (!l10nKeys[entry.key])
    {
      flow.warn({
        file: entry.file.relpath,
        message: 'Unknown path `' + entry.key + '` for basis.l10n.getToken'
      });
    }
  fconsole.endl();


  //
  // Validate templates
  //
  fconsole.start('Validate template paths');
  for (var i = 0, entry; entry = tmplRefs[i]; i++)
    if (!l10nKeys[entry.name])
    {
      flow.warn({
        file: entry.file.relpath,
        message: 'Unknown l10n path: {l10n:' + entry.key + '}'
      });
    }
  fconsole.endl();


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
                    message: 'Duplicate key ' + inputKey + ' for ' + dictName + ' (ignored)'
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

};
