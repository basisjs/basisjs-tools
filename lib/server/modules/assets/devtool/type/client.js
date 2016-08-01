var entity = require('basis.entity');

function stringOrNull(value){
  return value == null ? null : String(value);
}

var Client = entity.createType('Client', {
  id: entity.StringId,
  online: Boolean,
  title: String,
  location: String,
  ui: stringOrNull,
  channels: entity.createSetType('Channel')
});

Client.extendReader(function(data){
  data.channels = data.devpanel
    ? data.devpanel.map(function(channelId){
        return {
          id: channelId,
          client: data.id
        };
      })
    : null;
});

module.exports = Client;
