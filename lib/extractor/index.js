
var handlers = [
  require('./html'),
  require('./js'),
  require('./tmpl'),
  require('./css'),
  require('./res'),
  require('./l10n')
];

module.exports = function(flow){
  handlers.forEach(function(handler){
    handler(flow);
  });
};