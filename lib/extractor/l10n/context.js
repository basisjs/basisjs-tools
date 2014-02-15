var path = require('path');

var hasOwnProperty = Object.prototype.hasOwnProperty;

function walkTokens(dictionary, culture, tokens, path){
  var cultureValues = dictionary.cultureValues[culture];

  path = path ? path + '.' : '';

  for (var name in tokens)
    if (hasOwnProperty.call(tokens, name))
    {
      var tokenName = path + name;
      var tokenValue = tokens[name];

      cultureValues[tokenName] = tokenValue;

      if (tokenName in dictionary.tokens == false)
        dictionary.tokens[tokenName] = new Token(dictionary, tokenName);

      if (tokenValue && (typeof tokenValue == 'object' || Array.isArray(tokenValue)))
        walkTokens(dictionary, culture, tokenValue, tokenName);
    }
}

/**
* @class
*/
var Dictionary = function(file, flow){
  this.file = file;
  this.tokens = {};
  this.cultureValues = {};
  this.ref = [];

  try {
    // apply token data
    var data = JSON.parse(file.content);
    file.jsResourceContent = data;

    for (var culture in data)
      if (!/^_|_$/.test(culture)) // ignore names with underscore in the begining or ending (reserved for meta)
      {
        this.cultureValues[culture] = {};
        walkTokens(this, culture, data[culture]);
      }

    // apply types
    var types = (data._meta && data._meta.type) || {};
    for (var key in this.tokens)
      if (types[key] == 'plural' || types[key] == 'markup')
        this.tokens[key].type = types[key];
  } catch(e) {
    flow.warn({
      file: this.file.relpath,
      message: 'Can\'t parse content of ' + file.relpath + ': ' + e
    });
  }
};

Dictionary.prototype.getToken = function(name){
  if (!this.hasToken(name))
  {
    var token = new Token(this, name);
    token.implicit = true;
    this.tokens[name] = token;
  }

  return this.tokens[name];
};

Dictionary.prototype.hasToken = function(name){
  return name in this.tokens;
};

Dictionary.prototype.addRef = function(file, refToken){
  for (var i = 0, ref; ref = this.ref[i]; i++)
    if (ref.file === file && ref.refToken === refToken)
      return;

  this.ref.push({
    file: file,
    refToken: refToken
  });
};


/**
* @class
*/
var Token = function(dictionary, name){
  this.dictionary = dictionary;
  this.name = name;
  this.ref = [];
};

Token.prototype.type = 'default';
Token.prototype.comment = null;

Token.prototype.addRef = function(file, refToken){
  for (var i = 0, ref; ref = this.ref[i]; i++)
    if (ref.file === file && ref.refToken === refToken)
      return;

  this.ref.push({
    file: file,
    refToken: refToken
  });
};


//
// exports
//
module.exports = {
  create: function(flow){
    return {
      version: 2,

      cultures: {},
      dictionaries: {},

      getToken: function(path){
        var parts = path.split('@');
        var name = parts[0];
        var dictionary = this.getDictionary(parts[1]);

        return dictionary.getToken(name);
      },
      getDictionary: function(filename){
        filename = path.resolve(filename);

        if (path.extname(filename) != '.l10n')
          filename = path.dirname(filename) + '/' + path.basename(filename, path.extname(filename)) + '.l10n';

        var dictionary = this.dictionaries[filename];

        if (!dictionary)
        {
          var file = flow.files.add({
            type: 'l10n',
            jsRefCount: 0,
            filename: filename
          });
          file.isResource = true;

          dictionary = this.dictionaries[filename] = new Dictionary(file, flow);
        }

        return dictionary;
      }
    };
  }
};
