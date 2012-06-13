var htmlparser = require('htmlparser2');
var path = require('path');
var fs = require('fs');

module.exports = function(flowData){
  var ast = flowData.html.ast;

  fs.writeFileSync(
    flowData.buildDir + path.basename(flowData.buildFile),
    ast.map(htmlparser.DomUtils.getOuterHTML, htmlparser.DomUtils).join(''),
    'utf-8'
  );
}