
//
// Extend buildin prototypes
//

Array.prototype.add = function(value){
  return this.indexOf(value) == -1 && !!this.push(value);
}
Array.prototype.remove = function(value){
  var pos = this.indexOf(value);

  if (pos != -1)
    this.splice(pos, 1);

  return pos != -1;
}

String.prototype.repeat = function(count){
  var result = [];
  for (var i = 0; i < count; i++)
    result[i] = this;
  return result.join('');
}

//
// Export functions
//

var mime = require('mime');
var dataUriRx = /^\s*data:\s*(\S+)\s*;/i;
var base64PrefixRx = /^\s*base64\s*,\s*/i;
var externalUri = /^(\/\/|\S+:)/i;

module.exports = {
  toDataUri: function(data, filename){
    return 'data:' + mime.lookup(filename) + ';base64,' + new Buffer(data).toString('base64');
  },
  resolveUri: function(uri){
    var m = uri.match(dataUriRx);

    if (m)
    {
      var result = {
        mime: m[1],
        content: uri.replace(dataUriRx, '')
      };

      // decode from base64
      if (base64PrefixRx.test(result.content))
      {
        result.base64 = true;
        result.content = new Buffer(result.content.replace(base64PrefixRx, ''), 'base64').toString('utf-8');
      };

      return result;
    }
    else
    {
      if (externalUri.test(uri))
        return {
          url: uri
        };
      else
        return {
          filename: uri
        };
    }
  }
};
