
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
  var classMap = {};

  flow.js.exportMap = exportMap;

  //
  // Collect info
  //
  for (var name in packages)
    if (packages.hasOwnProperty(name))
    {
      var files = packages[name];
      for (var i = 0, file; file = files[i]; i++)
        processFile(fconsole, file, rootNames, refs, exportMap, classMap);
    }

  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script' && !file.rvisited)
      processFile(fconsole, file, rootNames, refs, exportMap, classMap);

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
    var token = cfg[0];
    var ref = cfg[1];

    if (refs.hasOwnProperty(key))
    {
      console.log('[exists]', key);

      var gVarName = '_global' + globalVarIdx++;
      cfg.push(gVarName);
      at.resolvePath(key, gVarName, refs);

      if (token[0] == 'object')
        ref[1] = ['assign', true, ['name', gVarName], ref[1]];
      else
        ref.splice(0, ref.length, 'assign', true, ['name', gVarName], ref.slice());
    }
    else
    {
      miss++;
      console.log(key + ' - is not used, cut from export' + (cfg.classDef ? '(ref count: ' + cfg.classDef.refCount + ')' : ''));

      if (cfg.classDef)
      {
        if (at.removeClassDefRef(cfg.classDef))
        {
          console.log('[!] Remove class def');
        }
      }

      // remove from export
      if (token[0] == 'object')
      {
        if (token[1].remove(ref))
        {
          if (!token[1].length)
            emptyExport.push(cfg);
        }
      }
      else
      {
        token.splice(0, token.length, 'block');
      }
    }
  }

  emptyExport.forEach(function(cfg){
    fconsole.log('[WARN] Empty module.exports for "' + cfg.namespace + '" found. Probably basis.require("' + cfg.namespace + '") is not required.');

    //cfg[0].splice(0, cfg[0].length, 'block');
  });

  console.log('key count:', keysOrder.length, 'not used:', miss);
};

module.exports.handlerName = '[js] Resolve pathes';

function putExportMap(name, exportCfg, exportMap, classMap, fconsole){
  if (exportMap.hasOwnProperty(name))
    fconsole.log('[WARN] Export map already contains ' + name);

  exportMap[name] = exportCfg;
  fconsole.log('[+] Add export symbol ' + name + (exportCfg.classDef ? ' (Class)' : ''));
  if (exportCfg.classDef)
    classMap[name] = exportCfg.classDef;
}

function processFile(fconsole, file, rootNames, refs, exportMap, classMap){
  fconsole.start(file.relpath);

  var namespace = file.namespace;

  if (namespace)
    rootNames.add(namespace.replace(/\..+$/, ''));

  var res = at.processPath(file.ast, rootNames, refs, classMap);

  file.ast = res.ast;
  file.rvisited = true;

  if (res.warn)
    res.warn.forEach(function(message){
      fconsole.log('[WARN] ' + message);
    });

  if (namespace)
  {
    for (var exportName in res.exports)
      if (res.exports.hasOwnProperty(exportName))
      {
        res.exports[exportName].namespace = namespace;
        putExportMap(namespace + '.' + exportName, res.exports[exportName], exportMap, classMap, fconsole);
      }
  }

  fconsole.endl();
}
