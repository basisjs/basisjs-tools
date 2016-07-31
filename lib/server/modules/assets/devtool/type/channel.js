var entity = require('basis.entity');
var Value = require('basis.data').Value;

var Channel = entity.createType('Channel', {
  id: entity.StringId,
  client: function(value){
    return value ? String(value) : null;
  }
});

Channel.current = new Value();

module.exports = Channel;
