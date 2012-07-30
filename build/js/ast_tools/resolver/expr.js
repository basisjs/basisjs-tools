
var fs = require('fs');
var utils = require('util');
var parser = require("uglify-js").parser;
var processor = require("uglify-js").uglify;

var ast = parser.parse('var a = null');
console.log(utils.inspect(ast,0,null,1));process.exit();


//var code = fs.readFileSync('test.js', 'utf-8');
var code = fs.readFileSync('../../../../../basisjs/src/basis/ui.js', 'utf-8');
var ast = parser.parse(code);


//console.log(utils.inspect(ast,0,null,1));process.exit();
var handler = require('./index');

var walker = require('../walker').ast_walker();
var res = handler.process(ast, walker, ['basis', 'should'])


  function iterate(obj, fn, thisObject){
    for (var key in obj)
      if (obj.hasOwnProperty(key))
        fn.call(thisObject, key, obj[key]);
  }


iterate(res.exports, function(key, value){
  console.log(key, value);
  value.splice(0, value.length, 'assign', true, ['name', '_g1'], value.slice());
});	

//console.log(utils.inspect(res,0,null,1));
console.log(Object.keys(res.refs));
handler.resolve(res.refs, 'basis.data.property', '_g1');
handler.resolve(res.refs, 'basis.ui.Node', '_g2');
handler.resolve(res.refs, 'should.be', '_g3');
console.log(processor.gen_code(res.ast, { beautify: 1}))