(module.exports = function(flow){
  var fconsole = flow.console;

  if (!flow.l10n)
  {
    fconsole.log('Skipped.');
    fconsole.log('basis.l10n not found');
    return;
  }

  if (flow.l10n.version == 1)
    require('./v1/relink.js')(flow);
  else
    require('./v2/relink.js')(flow);

}).handlerName = '[l10n] Relink';
