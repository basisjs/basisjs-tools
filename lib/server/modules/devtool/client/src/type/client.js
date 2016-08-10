var entity = require('basis.entity');

function stringOrNull(value){
  return value == null ? null : String(value);
}

var Client = entity.createType('Client', {
  id: entity.StringId,
  online: Boolean,
  title: String,
  location: String,
  num: Number,
  uiType: stringOrNull,
  uiContent: stringOrNull,
  features: {
    defValue: [],
    type: Array
  }
});

module.exports = Client;
