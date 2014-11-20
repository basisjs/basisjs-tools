(module.exports = function(flow){
  var fconsole = flow.console;

  if (!flow.l10n)
  {
    fconsole.log('Skipped.');
    fconsole.log('basis.l10n not found');
    return;
  }

  if (flow.l10n.version == 1)
    require('./v1/buildIndex.js')(flow);
  else
    require('./v2/buildIndex.js')(flow);

}).handlerName = '[l10n] Build index';
