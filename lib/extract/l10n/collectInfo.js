var path = require('path');

(module.exports = function(flow){

  if (!flow.l10n)
  {
    flow.console.log('Skiped.');
    flow.console.log('basis.l10n not found');
    return;
  }

  if (flow.l10n.version == 1)
    require('./collectInfo_v1.js')(flow);
  else
    require('./collectInfo_v2.js')(flow);

}).handlerName = '[l10n] Collect info';
