var l10n = require('basis.l10n');
var template = require('basis.template');

basis.require('./root/require.js');
basis.resource('./root/resource.js');
basis.asset('./root/asset.js');

require('./require.js');
resource('./resource.js');
asset('./asset.js');
l10n.dictionary('./root/explicit.l10n');
l10n.dictionary('./root/implicit.js');
l10n.dictionary(__dirname + '/explicit.l10n');
l10n.dictionary(__dirname + '/implicit.js');
var dict = l10n.dictionary(__filename);
dict.token('test');

// resolve by ns
require('ns');
basis.require('ns.basisrequire');
require('ns.require');

basis.require('ns:ns-basisrequire.js');
require('ns:ns-require.js');

basis.resource('ns:basisresource.js');
resource('ns:resource.js');

basis.asset('ns:basis-asset.json');
asset('ns:asset.json');

l10n.dictionary('ns:dictionary.l10n');

// // should not produce new filenames
basis.require('ns:../ns-basisrequire.js');
require('ns:../ns-require.js');
basis.resource('ns:../basisresource.js');
resource('ns:../resource.js');
basis.asset('ns:../basis-asset.json');
asset('ns:../asset.json');
l10n.dictionary('ns:../dictionary.l10n');


// templates
resource('./template/rel.tmpl');
resource('./template/ns.tmpl');
template.define('ns.template', resource('ns:template.tmpl')); // TODO: remove when template package will be available
