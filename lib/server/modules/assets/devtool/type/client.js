var entity = require('basis.entity');

var Client = entity.createType('Client', {
  id: entity.StringId,
  online: Boolean,
  devpanel: Boolean,
  title: String,
  location: String,
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
