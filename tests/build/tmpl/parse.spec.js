var parse = require('../../../build/tmpl/parse.js');
//todo: mock basis dependency
global.document = require('jsdom-nocontextifiy').jsdom();
global.basis = require('../../lib/basis/src/basis.js').basis;
basis.require('basis.template');

function getFlowData(content, spy){
  return {
    files: {
      queue: [{
        baseURI: '/some/dir/',
        type: 'template',
        content: content
      }],
      add: spy || function(){return {};},
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
}

describe('template parse', function(){
  it('should produce decl', function(){
    var content = '<div/>';
    var flowData = getFlowData(content);

    parse(flowData);

    var file = flowData.files.queue[0];
    expect(file.decl.tokens).toEqual([[1,0,["element"],"div",0,0]]);
  });

  it('should find css resources', function(){
    var content = '<b:resource src="resource.css"/>';
    var spy = jasmine.createSpy('add files').andReturn({});
    var flowData = getFlowData(content, spy);

    parse(flowData);

    expect(spy).toHaveBeenCalledWith({
      source: 'tmpl:resource',
      filename : '/some/dir/resource.css'
    });
  });
});