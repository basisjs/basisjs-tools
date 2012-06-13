var htmlparser = require("htmlparser2");

module.exports = function(flowData){
  var dom = flowData.htmlTokens;

  console.log(dom.map(htmlparser.DomUtils.getOuterHTML, htmlparser.DomUtils).join(''));
}