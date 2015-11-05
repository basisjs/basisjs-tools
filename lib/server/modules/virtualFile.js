var virtualPath = new Map();

module.exports = {
  add: function(filename, fn){
    if (virtualPath.has(filename))
    {
      console.warn('virtualPath#add: callback for `' + filename + '` is already set');
      return;
    }

    virtualPath.set(filename, fn);
  },
  remove: function(){
    if (!virtualPath.has(filename))
    {
      console.warn('virtualPath#remove: no callback for `' + filename + '`');
      return;
    }

    virtualPath.delete(filename);
  },
  has: function(filename){
    return virtualPath.has(filename);
  },
  get: function(filename){
    return virtualPath.get(filename);
  }
};
