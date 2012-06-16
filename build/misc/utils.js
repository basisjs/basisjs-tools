
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

var dataUriRx = /^\s*data:\s*(\S+)\s*;/i;
var base64PrefixRx = /^\s*base64\s*,\s*/i;
var externalUri = /^(\/\/|\S+:)/i;

function resolveUri(uri){
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

var mimeByExt = {
  '.js': 'text/javascript',
  '.css': 'text/style',
  '.tmpl': 'text/plain',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.tiff': 'image/tiff'
};


module.exports = {
  resolveUri: resolveUri,
  toDataUri: function(data, filename){
    var mime = mimeByExt[path.extname(filename)];
    return 'data:' + mime + ';base64,' + new Buffer(data).toString('base64');
  }
}