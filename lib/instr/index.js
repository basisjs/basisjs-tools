var lib = require('./lib');

module.exports = function (content, filename, cb){
  return lib.processCode(content, filename, cb);
};
