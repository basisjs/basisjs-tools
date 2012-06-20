var parse = require('../../../build/js/parse.js');

function getFlowData(code, addFilesSpy){
  return {
    inputDir: '/some/dir',
    files: {
      queue: [{
        filename: '/some/dir/source/file/name.js',
        type: 'script',
        content: code
      }],
      add: addFilesSpy,
      relpath: function(filename){
        return filename;
      }
    },
    js: {
      base: {}
    },
    console: {
      log: function(){},
      incDeep: function(){},
      decDeep: function(){}
    }
  };
}

function getSpy(){
  return jasmine.createSpy('files add').andCallFake(function(){
    return 'script';
  });
}

describe('js parse', function(){
  it('should find `basis.resource` calls', function(){
    var code = 'basis.resource("resource/path")';
    var addFilesSpy = getSpy();
    var flowData = getFlowData(code, addFilesSpy);
    
    parse(flowData);

    var addFilesArg = addFilesSpy.argsForCall[0][0];
    expect(addFilesArg).toEqual({
      source: 'js:basis.resource',
      filename: '/some/dir/resource/path'
    });
  });

  it('should find `resource` calls', function(){
    var code = 'resource("resource/path")';
    var addFilesSpy = getSpy();
    var flowData = getFlowData(code, addFilesSpy);
    
    parse(flowData);

    var addFilesArg = addFilesSpy.argsForCall[0][0];
    expect(addFilesArg).toEqual({
      source: 'js:basis.resource',
      filename: '/some/dir/source/file/resource/path'
    });
  });

  it('should find `basis.require` calls', function(){
    var code = 'basis.require("app.some.package")';
    var addFilesSpy = getSpy();
    var flowData = getFlowData(code, addFilesSpy);
    
    parse(flowData);

    var addFilesArg = addFilesSpy.argsForCall[0][0];
    expect(addFilesArg).toEqual({
      source: 'js:basis.require',
      filename: '/some/dir/app/some/package.js'
    });
  });

  it('should evaluate `__dirname` in require/resource calls', function(){
    var code = 'basis.resource(__dirname + "/subresource/path")';
    var addFilesSpy = getSpy();
    var flowData = getFlowData(code, addFilesSpy);
    
    parse(flowData);

    var addFilesArg = addFilesSpy.argsForCall[0][0];
    expect(addFilesArg).toEqual({
      source: 'js:basis.resource',
      filename: '/some/dir/source/file/subresource/path'
    });
  });
});