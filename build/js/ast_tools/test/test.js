//  String(y).toLowerCase();

function someFunction(){
  return 1;
}

var a = { a: 1 };
var b = { b: 2 };

(function(){

  function extend(obj, source){
    for (var key in source)
      if (source.hasOwnProperty(key))
        obj[key] = source[key];
  }

  /*var x = someFunction;

  someFunction(3, 4).extend(1,2);

  var z;
  var y = (z = x()).extend2();

  String(y).toLowerCase();

  z.extend(5);*/

  extend(a, b);
  //a.hasOwnProperty('a');
  var x = a.self();
  x.hasOwnProperty('a');
  x.hasOwnProperty('b');

})()