
var at = require('../../ast').js;
var DEBUG = false;

module.exports = function(flow){
  var fconsole = flow.console;

  if (!flow.options.jsResolvePath)
  {
    fconsole.log('Skiped.')
    fconsole.log('Use option --js-resolve-path for path resolving');
    return;
  }

  var packages = flow.js.packages;
  var queue = flow.files.queue;

  var rootNames = ['basis'];
  var refs = {};
  var exportMap = {};
  var exports = [];
  var namespaces = flow.js.namespaces;

 // console.log(require('util').inspect(at.parse('exports = { a:  new A }',1), null, 12 ));
 // process.exit();

  //
  // Collect info
  //

  var k = 0;
  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script')
    {
      processFile(file, flow);
      // if (++k == 6 )
      // {
      //   //console.log(file.relpath, file.jsScope.resolve(at.parse('this.exports', 1)));
      //   break;
      // }
    }

  for (var ns in namespaces)
  {
    var self = namespaces[ns];
    //console.log(self.obj)
    // if (!self.obj.exports)
    // {
    //   console.log(ns + ' has no obj.exports');
    //   continue;
    // }
    // console.log(ns, self.obj.exports)
    // if (!self.objSource)
    // {
    //   //console.log(ns + ' has no objSource :(')//, self.obj.exports);
    //   continue;
    // }
    var nsExports = self.obj.exports;
    for (var key in nsExports.obj)
      if (nsExports.objSource[key])
        exports.push({
          path: ns + '.' + key,
          source: nsExports.objSource[key],
          key: key,
          token: nsExports.obj[key]
        });
  }
  

  
  var cutCount = 0;
  var globalVarIdx = 0;
  var globalVars = [];
  for (var i = 0, entry; entry = exports[i]; i++)
  {
    var refs = entry.token.refs_;
    var refCount = refs ? refs.length : 0;

    cutCount += !refCount;

    if (refCount && !entry.token.globalized)
    {
      if (entry.source[0] != 'object')
      {
        fconsole.log(entry.path + ' (' + refCount + ' refs) - can\'t be globalized, bacause source is not an object');
        continue;
      }
      
      var gVarName = '_global' + globalVarIdx++;

      fconsole.log(entry.path + ' (' + refCount + ' refs) add to package scope as ' + gVarName);

      globalVars.push([gVarName]);
      // token -> _globalN = token
      var prop = findObjectEntry(entry.source, entry.key);
      var tmp = prop[1];
      prop[1] = ['assign', true, ['name', gVarName], tmp];
      // var tmp = entry.token.slice(0);
      // entry.token.length = 0;
      // entry.token.push('assign', true, ['name', gVarName], tmp);
      entry.token.globalized = true;

      for (var j = 0, token; token = refs[j]; j++)
      {
        if (DEBUG)
          token[1] += ' ~~> ' + gVarName;
        else
        {
          // foo.bar.baz -> _globalN
          token.length = 0;
          token.push('name', gVarName);
        }
      }
    }
    else
    {
      if (entry.path == 'basis.namespace')
      {
        fconsole.log('[IGNORE] basis.namespace is special case, ignore for now');
        continue;
      }

      fconsole.log('[CUT]', entry.path);
      if (entry.source[0] == 'object')
      {
        var prop = findObjectEntry(entry.source, entry.key);
        entry.source[1].splice(entry.source[1].indexOf(prop), 1);
      }
    }
    //if (token[0] == 'basis.dom.head') process.exit();
  }
  //process.exit();

  //
  // Resolve pathes
  //
  var miss = 0;
  var emptyExport = [];
  // for (var i = 0, key, globalVarIdx = 0; key = keysOrder[i]; i++)
  // {
  //   var cfg = exportMap[key];
  //   var token = cfg.token;
  //   var ref = cfg.ref;

  //   /*if (cfg.classDef && refs.hasOwnProperty(key + '.prototype'))
  //   {
  //     var gVarName = '_global' + globalVarIdx++;
  //     cfg.push(gVarName);
  //     at.resolvePath(key + '.prototype', gVarName, refs);
  //   }*/

  //   if (key == 'basis.namespace' || refs.hasOwnProperty(key))
  //   {
  //     console.log(key);

  //     var gVarName = '_global' + globalVarIdx++;
  //     at.resolvePath(key, gVarName, refs);

  //     cfg.addRef(gVarName);
  //   }
  //   else
  //   {
  //     miss++;
  //     console.log('[CUT] ' + key + (cfg.classDef ? ' (ref count: ' + cfg.classDef.refCount + ')' : ''));

  //     if (cfg.classDef)
  //     {
  //       if (at.removeClassDefRef(cfg.classDef))
  //       {
  //         console.log('> [!] Remove class def');
  //       }
  //     }

  //     // remove from export
  //     if (cfg.remove() && cfg.isEmpty())
  //       emptyExport.push(cfg);
  //   }
  // }

  emptyExport.forEach(function(cfg){
    fconsole.log('[WARN] Empty module.exports for "' + cfg.namespace + '" found. Probably basis.require("' + cfg.namespace + '") is not required.');

    //cfg[0].splice(0, cfg[0].length, 'block');
  });

  if (globalVars.length)
    flow.js.globalVars = globalVars;

  console.log('key count:', exports.length, 'not used:', cutCount);
  //process.exit();
};

module.exports.handlerName = '[js] Resolve pathes';


var throwIdx = 0;
function processFile(file, flow){
  var fconsole = flow.console;
  var globalScope = flow.js.jsScope;

  fconsole.start(file.relpath);
  
  file.throwCodes = [];
  at.walk(file.ast, {
    '*': function(token){
      if (token.ref_)
      {
        var refs = token.ref_.refs_ || (token.ref_.refs_ = []);

        if (DEBUG)
        {
          var token_ = ['string', at.translate(token) + ' ~~> ' + token.refPath_];
          refs.push(token_);
          return token_;
        }

        refs.push(token);
        /**/
        //console.log(token.refPath_)
        //console.log(globalScope.resolve(at.parse(token.refPath_, 1)).token == token.ref_);
        // if (token.refPath_ == 'basis.data.index')
        // {
        //   console.log(globalScope.resolve(at.parse(token.refPath_, 1)));
        //   console.log(token.ref_);
        //   process.exit();
        // }
      }
    },
    'throw': function(token){
      file.throwCodes.push([++throwIdx, token.slice()]);
      token[1] = ['num', throwIdx];
      return token;
    }
  });

  fconsole.endl();
}

function findObjectEntry(obj, key){
  var props = obj[1];
  for (var i = 0, prop; prop = props[i]; i++)
    if (prop[0] == key)
      return prop;
}
