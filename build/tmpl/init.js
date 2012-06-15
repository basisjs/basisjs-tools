
module.exports = function(flowData){
  global.document = require('jsdom-nocontextifiy').jsdom();
  global.basis = require(flowData.js.basisScript).basis;
  basis.require('basis.template');
}