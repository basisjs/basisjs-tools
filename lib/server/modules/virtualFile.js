var virtualPath = {};
var hasOwnProperty = Object.prototype.hasOwnProperty;

var api = {
  add: function(filename, fn){
    if (api.has(filename))
    {
      console.warn('virtualPath#add: callback for `' + filename + '` is already set');
      return;
    }

    virtualPath[filename] = fn;
  },
  remove: function(){
    if (!api.has(filename))
    {
      console.warn('virtualPath#remove: no callback for `' + filename + '`');
      return;
    }

    delete virtualPath[filename];
  },
  has: function(filename){
    return hasOwnProperty.call(virtualPath, filename);
  },
  get: function(filename){
    return virtualPath[filename];
  }
};

module.exports = api;
