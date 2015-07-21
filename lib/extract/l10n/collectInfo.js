(module.exports = function(flow){
  // TODO: collect additional info about l10n
}).handlerName = '[l10n] Collect info';

module.exports.skip = function(flow){
  if (!flow.l10n)
    return 'basis.l10n not found';

  return 'Nothing to do for now';
};
