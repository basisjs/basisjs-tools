var util = require('util');
var htmlparser = require("htmlparser2");
var fetchFiles = require('../../../build/html/fetchFiles.js');

function inspect(obj){
  console.log(util.inspect(obj, false, null, true));
}

var handler = new htmlparser.DefaultHandler();
var parser = new htmlparser.Parser(handler,  { lowerCaseTags: true });

function getAst(content){
  parser.parseComplete(content);
  return handler.dom;
}

function getFlowData(ast, spy){
  return {
    inputDir: '/some/dir',
    inputFile:{
      ast: ast
    },
    files: {
      add: spy
    },
    css: {
      genericFile : {}
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

describe('html fetchFiles', function(){

  it('should find external scripts without type', function(){
    var ast = getAst('<script src="some/path"></script>');
    var addFilesSpy = getSpy();
    var flowData = getFlowData(ast, addFilesSpy);
    fetchFiles(flowData);
    var args = addFilesSpy.argsForCall[0][0];
    expect(args.filename).toBe('/some/dir/some/path');
    expect(args.source).toBe('html:script');
    expect(args.type).toBe('script');
  });

  it('should find external scripts with type `text/javascript`', function(){
    var ast = getAst('<script src="some/path" type="text/javascript"></script>');
    var addFilesSpy = getSpy();
    var flowData = getFlowData(ast, addFilesSpy);
    fetchFiles(flowData);
    var args = addFilesSpy.argsForCall[0][0];
    expect(args.filename).toBe('/some/dir/some/path');
    expect(args.source).toBe('html:script');
    expect(args.type).toBe('script');
  });

  it('should ignore external scripts with type other than `text/javascript`', function(){
    var ast = getAst('<script src="some/path" type="text/vbscript"></script>');
    var addFilesSpy = getSpy();
    var flowData = getFlowData(ast, addFilesSpy);
    fetchFiles(flowData);
    var args = addFilesSpy.argsForCall;
    expect(args.length).toBe(0);
  });

  it('should find inline scripts', function(){
    var ast = getAst('<script>content</script>');
    var addFilesSpy = getSpy();
    var flowData = getFlowData(ast, addFilesSpy);
    fetchFiles(flowData);
    var args = addFilesSpy.argsForCall[0][0];
    expect(args.filename).toBe(undefined);
    expect(args.inline).toBe(true);
    expect(args.content).toBe('content');
    expect(args.source).toBe('html:script');
    expect(args.type).toBe('script');
  });

  it('should find external styles', function(){
    var ast = getAst('<link rel="stylesheet" href="some/path">');
    var addFilesSpy = getSpy();
    var flowData = getFlowData(ast, addFilesSpy);
    fetchFiles(flowData);
    var args = addFilesSpy.argsForCall[0][0];
    expect(args.filename).toBe('/some/dir/some/path');
    expect(args.source).toBe('html:link');
    expect(args.type).toBe('style');
    expect(args.media).toBe('all');
  });

  it('should find inline styles', function(){
    var ast = getAst('<style>content</style>');
    var addFilesSpy = getSpy();
    var flowData = getFlowData(ast, addFilesSpy);
    fetchFiles(flowData);
    var args = addFilesSpy.argsForCall[0][0];
    expect(args.filename).toBe(undefined);
    expect(args.inline).toBe(true);
    expect(args.source).toBe('html:style');
    expect(args.type).toBe('style');
    expect(args.media).toBe('all');
  });

});