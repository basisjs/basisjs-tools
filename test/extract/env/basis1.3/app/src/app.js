var l10n = require('basis.l10n');
var template = require('basis.template');

basis.require('./root/require.js');
basis.resource('./root/resource.js');
basis.asset('./root/asset.js');

require('./require.js');
resource('./resource.js');
l10n.dictionary('./root/explicit.l10n');
l10n.dictionary('./root/implicit.js');
l10n.dictionary(__dirname + '/explicit.l10n');
l10n.dictionary(__dirname + '/implicit.js');
l10n.dictionary(__filename);

// resolve by ns
require('ns');
basis.require('ns.basisrequire');
require('ns.require');

// unknown ns
require('unknownns');
basis.require('unknownns.basisrequire');
require('unknownns.require');

// templates
resource('./template/rel.tmpl');
