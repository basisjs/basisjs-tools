var tmplAt = require('../../ast').tmpl;
var path = require('path');

(module.exports = function(flow){

  if (!flow.l10n.module)
  {
    flow.console.log('Skiped.');
    flow.console.log('basis.l10n not found');
    return;
  }

  if (flow.l10n.version == 2)
    require('./collectInfo_v2.js')(flow);
  else
    require('./collectInfo_v1.js')(flow);

}).handlerName = '[l10n] Collect info';
