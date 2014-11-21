(module.exports = function(flow){

  if (flow.l10n.version == 1)
    require('./v1/relink.js')(flow);
  else
    require('./v2/relink.js')(flow);

}).handlerName = '[l10n] Relink';

module.exports.skip = function(flow){
  if (!flow.l10n)
    return 'basis.l10n not found';
};
