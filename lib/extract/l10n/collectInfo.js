(module.exports = function(flow){

  if (flow.l10n.version == 1)
    require('./collectInfo_v1.js')(flow);
  else
    require('./collectInfo_v2.js')(flow);

}).handlerName = '[l10n] Collect info';

module.exports.skip = function(flow){
  if (!flow.l10n)
    return 'basis.l10n not found';
};
