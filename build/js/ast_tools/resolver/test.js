
  basis.require('basis.ui');
  basis.require('app.type');

  var aa = basis;
  var bb = aa;
  var cc = bb;

  var ui = basis.ui;
  var Node = ui.Node;
  var Property = basis.data.property.Property;
  var fn = function x(){
    return 1;
  }

  ui = should.be.it;

  function lev1(){
    function lev2(ui, Node){
      var a = new ui.DontExtract();
      return new Node();
    }
    var x = new Node();
    return new ui.eee.GroupingNode(lev2());
  }

  exports = {};
  exports.property1 = 123;
  module.exports = {
    p1: a + (b + 1),
    p2: 2
  };
  module.exports.property2 = 123;
