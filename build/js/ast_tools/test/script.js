
var at = require('../index');
var ast = at.parse(require('fs').readFileSync('test/test.js', 'utf-8'));
var gs = new at.Scope('global');

var sss = gs.put('String', 'var', ['function', 'String', ['val']]);
sss.obj = {
  toLowerCase: ['function', null, []]
};

at.applyScope(ast, gs);
var fn = gs.get('someFunction').token;

var extend = ['function', null, [], []];
extend.run = function(){
  console.log('extend called');
}

fn.run = function(token){
  console.log('It works!', arguments);
  token.obj = { extend: extend };
}

console.log(fn ? 'Found': 'Not found');

sss.token.run = function(token){
    token.obj = sss.obj;
    console.log('ok');
  };

sss.obj.toLowerCase.run = function(token){
    console.log('Ha?!');
  };

require('../structure').process(ast);

console.log('?', gs.get('a').token.obj);