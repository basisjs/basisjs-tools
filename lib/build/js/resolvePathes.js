
var at = require('../../ast').js;
var globalVarIdx = 0;

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

// console.log(require('util').inspect(at.parse('exports = { a:  new A }',1), null, 12 ));
// process.exit();

  //
  // Collect info
  //

  var k = 0;
  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script')
    {
      processFile(file, flow, exports);
      // if (++k == 6 )
      // {
      //   //console.log(file.relpath, file.jsScope.resolve(at.parse('this.exports', 1)));
      //   break;
      // }
    }
  
  var cutCount = 0;
  for (var i = 0, token; token = exports[i]; i++)
  {
    var refCount = token[1].refCount_;
    cutCount += !refCount;
    if (refCount)
      fconsole.log(token[0], refCount);
    else
    {
      fconsole.log('[CUT]', token[0]);
      if (token[2][0] == 'object')
      {
        var props = token[2][1];
        for (var j = 0, prop; prop = props[j]; j++)
          if (prop[0] == token[3])
          {
            props.splice(j, 1);
            break;
          }
      }
    }
    //if (token[0] == 'basis.dom.head') process.exit();
  }

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

  var globalVars = [];/*Object.keys(exportMap).map(function(key){
    return exportMap[key].refName || null;
  }).filter(Boolean);*/

  if (globalVars.length)
    flow.js.globalVars = globalVars;

  console.log('key count:', exports.length, 'not used:', cutCount);
  //process.exit();
};

module.exports.handlerName = '[js] Resolve pathes';


var throwIdx = 0;
function processFile(file, flow, exports){
  var fconsole = flow.console;
  var globalScope = flow.js.jsScope;

  fconsole.start(file.relpath);
  
  file.throwCodes = [];
  at.walk(file.ast, {
    '*': function(token){
      if (token.ref_)
      {
        token.ref_.refCount_ = (token.ref_.refCount_ || 0) + 1;
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

  if (file.namespace)
  {
    var self = file.jsScope.resolve(['name', 'this']);
    //console.log(self.obj)
    for (var key in self.obj)
      if (self.objSource && self.objSource[key])
        exports.push([file.namespace + '.' + key, self.obj[key], self.objSource[key], key]);
  }

  fconsole.endl();
}
