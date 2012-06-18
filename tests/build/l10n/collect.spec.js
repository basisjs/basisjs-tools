var parser = require('uglify-js').parser;
var collect = require('../../../build/l10n/collect.js');

describe('l10n dictionaries collect', function(){
  it('should extract dictionary id, extract and resolve path, collect dictionary keys from createDictionary calls', function(){
    var code = "\
      basis.l10n.createDictionary('app.dict', __dirname + 'l10n', {\
        someKey: 'someValue',\
        anotherKey: 'anotherValue'\
      });\
      basis.l10n.createDictionary('app.dict.subdict', __dirname + 'l10n', {\
        a: 'someValue',\
        b: 'anotherValue'\
      });";
    
    var file = {
      type: 'script',
      ast: parser.parse(code),
      filename: 'app/somepath/someFile.js'
    };

    var flowData = {
      files: {
        queue: [file],
        relpath: function(filename){
          return filename;
        }
      },
      console: {
        log: function(){},
        incDeep: function(){},
        decDeep: function(){}
      }
    };

    collect(flowData);

    var expectedResult = {
      dictList: 
      {
        'app.dict': {
          path: 'app/somepath/l10n',
          keys: ['someKey', 'anotherKey']
        },
        'app.dict.subdict': {
          path: 'app/somepath/l10n',
          keys: ['a', 'b']
        }
      },
      l10nKeys: ['app.dict.someKey', 'app.dict.anotherKey', 'app.dict.subdict.a', 'app.dict.subdict.b']
    };

    expect(flowData.dictList).toEqual(expectedResult.dictList);
    expect(flowData.l10nKeys).toEqual(expectedResult.l10nKeys);
  });
});