
var at = require('../../ast').js;
var DEBUG = false;
var defunParentBody = {
  'toplevel': 1,
  'defun': 3,
  'function': 3
};

module.exports = function(flow){
  function makeTokenGlobal(token, path){
    var gVarName = '__global' + globalVarIdx++;
    var refs = token.refs_;

    fconsole.log(gVarName + ' = ' + path + ' (' + refs.length + ' refs)');

    token.globalized = gVarName;
    globalVars.push([gVarName]);
    globalTokens.push(token);

    for (var j = 0, refToken; refToken = refs[j]; j++)
    {
      if (DEBUG)
        refToken[1] += ' ~~> ' + gVarName;
      else
      {
        // foo.bar.baz -> _globalN
        refToken.length = 0;
        refToken.push('name', gVarName);
      }
    }
  }

  var fconsole = flow.console;

  if (!flow.options.jsResolvePath)
  {
    fconsole.log('Skiped.')
    fconsole.log('Use option --js-resolve-path for path resolving');
    return;
  }

  var globalScope = flow.js.jsScope;
  var packages = flow.js.packages;
  var queue = flow.files.queue;

  var rootNames = ['basis'];
  var refs = {};
  var exportMap = {};
  var exports = [];
  var namespaces = flow.js.namespaces;

  var globalVarIdx = 0;
  var globalVars = [];
  var globalTokens = [];
  var pathMap = {};

  //  console.log(require('util').inspect(at.parse('["asd", function(){ return 1 }]'), null, 12 ));
  //  process.exit();

  //
  // Collect info
  //

  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script')
    {
      fconsole.start(file.relpath);
      
      at.walk(file.ast, {
        '*': function(token){
          if (token.ref_)
          {
            var refs = token.ref_.refs_ || (token.ref_.refs_ = []);

            if (DEBUG && pathMap[token.refPath_] && pathMap[token.refPath_] != token.ref_) {
              console.log('various ref_ for same path', token.refPath_, pathMap[token.refPath_], token.ref_);
              process.exit();
            }
            pathMap[token.refPath_] = token.ref_;

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
        }
      });

      fconsole.endl();
    }


  for (var path in pathMap)
  {
    var token = pathMap[path];

    if (!token.in_code)
      continue;

    if (token[0] != 'defun')
    {
      makeTokenGlobal(token, path);
      var tmp = token.splice(0);
      token.push('assign', true, ['name', token.globalized], tmp);
    }
    else
    {
      var parent = token.parent_;
      if (parent)
      {
        if (parent[0] in defunParentBody)
        {
          makeTokenGlobal(token, path);
          var body = parent[defunParentBody[parent[0]]];
          body.splice(body.indexOf(token), 0,
            ['stat', ['assign', true, ['name', token.globalized], ['name', token[1]]]]
          );
        }
        else
        {
          console.log('can\'t globalize ' + path + ' (parent ' + parent[0] + ')');
        }
      }
      else
      {
        console.log('can\'t globalize ' + path + ' (' + token[0] + ')');
      }
    }
  }


  // var keys = Object.keys(xmap).sort();
  // keys.forEach(function(key){
  //   console.log(key, xmap[key][0]);
  //   //if (xmap[key][0] == 'defun')
  // });

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
  var globalized = [];
  for (var i = 0, entry; entry = exports[i]; i++)
  {
    var refs = entry.token.refs_;
    var refCount = refs ? refs.length : 0;

    // if (entry.path == 'basis.template.define'){
    //   console.log(entry.token);
    // }

    if (refCount)
    {
      if (entry.token.globalized)
        continue;

      if (entry.source[0] != 'object')
      {
        fconsole.log(entry.path + ' (' + refCount + ' refs) - can\'t be globalized, bacause source is not an object');
        continue;
      }

      makeTokenGlobal(entry.token, entry.path);
      
      // token -> __globalN = token
      var prop = findObjectEntry(entry.source, entry.key);
      var tmp = prop[1];
      prop[1] = ['assign', true, ['name', entry.token.globalized], tmp];
      // var tmp = entry.token.slice(0);
      // entry.token.length = 0;
      // entry.token.push('assign', true, ['name', gVarName], tmp);
    }
    else
    {
      if (entry.path == 'basis.namespace')
      {
        fconsole.log('[IGNORE] basis.namespace is special case, ignore for now');
        continue;
      }

      cutCount++;

      fconsole.log('[CUT]', entry.path);
      if (entry.source[0] == 'object')
      {
        var prop = findObjectEntry(entry.source, entry.key);
        //entry.source[1].splice(entry.source[1].indexOf(prop), 1);
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
    fconsole.log('[WARN] Empty module.exports for "' + cfg.namespace + '" found. ' +
      'Probably basis.require("' + cfg.namespace + '") is not required.');

    //cfg[0].splice(0, cfg[0].length, 'block');
  });

  if (globalVars.length)
    flow.js.globalVars = globalVars;

  console.log('exports key count:', exports.length, 'not used:', cutCount);

  //process.exit();
};

module.exports.handlerName = '[js] Resolve pathes';


function findObjectEntry(obj, key){
  var props = obj[1];
  for (var i = 0, prop; prop = props[i]; i++)
    if (prop[0] == key)
      return prop;
}
