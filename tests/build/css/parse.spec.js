var util = require('util');

function inspect(obj){
  console.log(util.inspect(obj, false, null, true));
}

var parse = require('../../../build/css/parse.js');

function getFlowData(content, spy){
  return {
    files: {
      queue: [{
        content: content,
        filename: '/some/css/resource.css',
        type: 'style'
      }],
      add: spy
    },
    console: {
      log: function(){},
      incDeep: function(){},
      decDeep: function(){}
    }
  };
}

describe('css parse', function(){
  it('should find local imports', function(){
    var spy = jasmine.createSpy();
    var flowData = getFlowData('@import url("style.css");', spy);

    parse(flowData);

    expect(spy).toHaveBeenCalledWith({
      source: 'css:import',
      filename: '/some/css/style.css' 
    });
  });

  it('should ignore external imports', function(){
    var spy = jasmine.createSpy();
    var flowData = getFlowData('@import url("http://somesite.io/style.css");', spy);

    parse(flowData);

    expect(spy).not.toHaveBeenCalled();
  });
});