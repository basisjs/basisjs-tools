var styl = require('stylus');

// server
module.exports = function(content, cb){
  styl(content).render(cb);
};

// build
module.exports.process = function(content, file, baseURI, console){
  console.log('Compile ' + file.relpath + ' to css');
  file.filename = file.filename.replace(/.styl$/i, '.css');
  //try {
  return styl(content).render();
  // } catch(e) {
  //   console.warn({
  //     file: file.relpath,
  //     fatal: true,
  //     message: e
  //   });
  // }
}