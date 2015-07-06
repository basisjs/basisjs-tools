var types = require("ast-types");
var config = require('../config');

var b = types.builders;
var n = types.namedTypes;

var registratorName = config.registratorName;


function buildRegistation(name, coords){
  return b.expressionStatement(
    b.callExpression( /* id, [] - call params */
      b.identifier(registratorName),
      [
        b.objectExpression([
          b.property(
            'init',
            b.identifier('line'),
            b.literal(coords.line)
          ),
          b.property(
            'init',
            b.identifier('column'),
            b.literal(coords.column)
          )
        ]),
        b.identifier(name)
      ]
    )
  )
}

function buildCallRegistation(start, node){
  return b.callExpression( /* id, [] - call params */
    b.identifier(registratorName),
    [
      b.objectExpression([
        b.property(
          'init',
          b.identifier('line'),
          b.literal(start.line)
        ),
        b.property(
          'init',
          b.identifier('column'),
          b.literal(start.column)
        )
      ]),
      node
    ]
  )
}

module.exports = {
  visitFunctionDeclaration: function(path){
    var node = path.node;
    var start = node.loc.start;
    var name = node.id.name;

    path.insertAfter(buildRegistation(name, start));

    this.traverse(path);
  },

  visitFunctionExpression: function(path){
    var node = path.node;
    var start = node.loc.start;

    path.replace(buildCallRegistation(start, node));

    // cancel traverse on this node
    return false;
  }
};
