var paths = new Map();

module.exports = {
  add: function(filename, fn){
    if (paths.has(filename))
    {
      console.warn('virtualPath#add: callback for `' + filename + '` is already set');
      return;
    }

    paths.set(filename, fn);
  },
  remove: function(){
    if (!paths.has(filename))
    {
      console.warn('virtualPath#remove: no callback for `' + filename + '`');
      return;
    }

    paths.delete(filename);
  },
  has: function(filename){
    return paths.has(filename);
  },
  get: function(filename){
    return paths.get(filename);
  }
};
