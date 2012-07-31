
var at = require('./ast_tools');
var globalVarIdx = 0;

module.exports = function(flow){
  var fconsole = flow.console;

  if (!flow.options.jsResolvePath)
  {
    fconsole.log('Skiped.')
    fconsole.log('Use option --js-resolve-path for path resolveing');
    return;
  }

  var packages = flow.js.packages;
  var queue = flow.files.queue;

  var rootNames = ['basis'];
  var refs = {};
  var exportMap = {};

  var basisFile = flow.files.get(flow.js.basisScript);

  if (basisFile)
    processFile(fconsole, basisFile, rootNames, refs, exportMap);

  //
  // Collect info
  //
  for (var name in packages)
    if (packages.hasOwnProperty(name))
    {
      var files = packages[name];
      for (var i = 0, file; file = files[i]; i++)
        processFile(fconsole, file, rootNames, refs, exportMap);
    }

  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script' && !file.rvisited)
      processFile(fconsole, file, rootNames, refs, exportMap);

  //
  // Resolve pathes
  //
  var miss = 0;
  var keysOrder = Object.keys(exportMap).sort(function(a, b){
    var la = a.split('.').length;
    var lb = b.split('.').length;

    return lb - la;
  });

  var emptyExport = [];
  for (var i = 0, key, globalVarIdx = 0; key = keysOrder[i]; i++)
  {
    var cfg = exportMap[key];
    var token = cfg.token;
    var ref = cfg.ref;

    /*if (cfg.classDef && refs.hasOwnProperty(key + '.prototype'))
    {
      var gVarName = '_global' + globalVarIdx++;
      cfg.push(gVarName);
      at.resolvePath(key + '.prototype', gVarName, refs);
    }*/

    if (refs.hasOwnProperty(key))
    {
      console.log(key);

      var gVarName = '_global' + globalVarIdx++;
      at.resolvePath(key, gVarName, refs);

      cfg.addRef(gVarName);
    }
    else
    {
      miss++;
      console.log('[CUT] ' + key + (cfg.classDef ? ' (ref count: ' + cfg.classDef.refCount + ')' : ''));

      if (cfg.classDef)
      {
        if (at.removeClassDefRef(cfg.classDef))
        {
          console.log('> [!] Remove class def');
        }
      }

      // remove from export
      if (cfg.remove() && cfg.isEmpty())
        emptyExport.push(cfg);
    }
  }

  emptyExport.forEach(function(cfg){
    fconsole.log('[WARN] Empty module.exports for "' + cfg.namespace + '" found. Probably basis.require("' + cfg.namespace + '") is not required.');

    //cfg[0].splice(0, cfg[0].length, 'block');
  });

  var globalVars = Object.keys(exportMap).map(function(key){
    return exportMap[key].refName || null;
  }).filter(Boolean);

  if (globalVars.length)
    flow.js.globalVars = globalVars;

  console.log('key count:', keysOrder.length, 'not used:', miss);
};

module.exports.handlerName = '[js] Resolve pathes';

function processFile(fconsole, file, rootNames, refs, exportMap){
  fconsole.start(file.relpath);

  var namespace = file.namespace;

  if (namespace)
    rootNames.add(namespace.split('.')[0]);

  var res = at.processPath(file.ast, rootNames, refs, exportMap, namespace);

  file.ast = res.ast;
  file.rvisited = true;
  file.throwCodes = res.throwCodes;

  if (res.messages)
    res.messages.forEach(function(message){
      fconsole.log((message.type ? '[' + message.type + '] ' : '') + message.text);
    });

  fconsole.endl();
}
