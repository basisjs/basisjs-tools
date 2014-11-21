(module.exports = function(flow){

  if (flow.l10n.version == 1)
    require('./v1/buildIndex.js')(flow);
  else
    require('./v2/buildIndex.js')(flow);

}).handlerName = '[l10n] Build index';

module.exports.skip = function(flow){
  if (!flow.l10n)
    return 'basis.l10n not found';
};
