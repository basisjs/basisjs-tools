var dataUriRx = /^\s*data:\s*(\S+)\s*;/i;
var base64PrefixRx = /^\s*base64\s*,\s*/i;
var externalUri = /^(\/\/|\S+:)/i;
var hashRx = /#.*$/;

/**
* Convert resource string to meta-object.
*   'data:mime/type;content#hash' -> {
*     mime: 'mime/type',
*     content: 'content',
*     hash: '#hash'
*   }
*
*   'data:mime/type;base64,content#hash' -> {
*     mime: 'mime/type',
*     content: 'decodedContent',
*     base64: true,
*     hash: '#hash'
*   }
*
*   'schema:url#hash' -> {
*     url: 'schema:url',
*     hash: '#hash'
*   }
*
*   '//url#hash' -> {
*     url: '//url',
*     hash: '#hash'
*   }
*
*   'anythingElse#hash' -> {
*     filename: 'anythingElse',
*     hash: '#hash'
*   }
*
* @param {string} uri
* @return {object}
*/
module.exports = function resolveUri(uri){
  var hash = '';
  uri = uri.trim().replace(hashRx, function(m){
    hash = m;
    return '';
  });

  var m = uri.match(dataUriRx);
  if (m)
  {
    var result = {
      mime: m[1],
      content: uri.replace(dataUriRx, ''),
      hash: hash
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
        url: uri,
        hash: hash
      };
    else
      return {
        filename: uri,
        hash: hash
      };
  }
};
