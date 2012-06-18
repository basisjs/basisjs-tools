module.exports = function(flowData){
  var queue = flowData.files.queue;
  var fconsole = flowData.console;

  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script')
    {
      fconsole.log(file.filename ? flowData.files.relpath(file.filename) : '[inline script]');
      fconsole.incDeep();

      process(file, flowData);

      fconsole.decDeep();
      fconsole.log();
    }
};

module.exports.handlerName = 'Extract dictionary creation calls';

var path = require('path');
var parser = require("uglify-js").parser;
var processor = require("uglify-js").uglify;
var astUtils = require('../misc/js-ast-utils');

function process(file, flowData){
  var ast = file.ast;
  var context = {
    __filename: file.filename || '',
    __dirname: file.filename ? path.dirname(file.filename) + '/' : ''
  };
  var walker = processor.ast_walker();
  var dictList = {};
  var l10nKeys = [];

  walker.with_walkers({
    call: function(expr, args){
      if (astUtils.isAstEqualsCode(expr, 'basis.l10n.createDictionary'))
      {
        var eargs = astUtils.getCallArgs(args, context);
        keys = Object.keys(eargs[2]);

        dictList[eargs[0]] = {
          path: eargs[1],
          keys: keys
        };

        keys.forEach(function(key){
          l10nKeys.push(eargs[0] + '.' + key);
        });  
      }
    }
  }, function(){
    return walker.walk(ast);
  });
  
  flowData.dictList = flowData.dictList || {};
  for (var i in dictList)
    flowData.dictList[i] = dictList[i];
  flowData.l10nKeys = flowData.l10nKeys ? flowData.l10nKeys.concat(l10nKeys) : l10nKeys;
}