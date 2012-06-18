var parser = require('uglify-js').parser;
var modifyCall = require('../../../build/l10n/modifyCall.js');

describe('l10n dictionaries modifyCall', function(){
  it('should replace identifier with number, replace path with empty string and replace keys with packed array', function(){

    var srcCode = "\
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
      ast: parser.parse(srcCode),
      filename: 'app/somepath/someFile.js'
    };

    var flowData = {
      files: {
        queue: [file],
        relpath: function(filename){
          return filename;
        }
      },
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
      l10nKeys: ['app.dict.someKey', 'app.dict.anotherKey', 'app.dict.subdict.a', 'app.dict.subdict.b'],
      console: {
        log: function(){},
        incDeep: function(){},
        decDeep: function(){}
      }
    };

    modifyCall(flowData);

    expectedCode = "\
      basis.l10n.createDictionary('app.dict', '', [ '1', 'anotherValue', 'someValue']);\
      basis.l10n.createDictionary('app.dict.subdict', '', [ '4', 'someValue', 'anotherValue']);";
    var expectedAst = parser.parse(expectedCode);

    expect(file.ast).toEqual(expectedAst);
  });
});