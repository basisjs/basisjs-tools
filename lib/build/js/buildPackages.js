
var path = require('path');
var at = require('../../ast').js;
var html_at = require('../../ast').html;
var MERGE = false;

module.exports = function(flow){

  var packages = flow.js.packages;
  var queue = flow.files.queue;
  var fconsole = flow.console;

  // create package files
  //["dot",["name","this"],"__resource__"]

  // build source map
  var basisFile = flow.js.basisScript && flow.files.get(flow.js.basisScript);

  if (basisFile)
  {
    // inject resources
    var inserted = false;
    var resourceToc = [];
    var resTypeByFirstChar = {
      '[': 'array',
      '{': 'object',
      '"': 'string',
      'f': 'function'
    };

    fconsole.start('Build resource map');
    basisFile.ast = at.walk(basisFile.ast, {
      "dot": function(token){
        var expr = token[1];
        var isRequiredHost = token[1][0] == 'name' && (token[1][1] == 'this' || token[1][1] == '__local6' || this.scope.resolve(token[1]) === this.scope.root.get('global'));

        // this.__resources__ || global.__resources__
        if (!inserted && isRequiredHost && token[2] == '__resources__')
        {
          inserted = true;
          return at.parse('0,' + (function(){
            var res = [];
            var resourceTypeWeight = {
              'json': 1,
              'template': 2,
              'script': 100
            };
            var stat = {};

            for (var jsRef in flow.js.resourceMap)
            {
              var file = flow.js.resourceMap[jsRef];

              if (!file.jsRefCount && file.type == 'template')
              {
                fconsole.log('[i] Drop resource:', file.relpath);
                continue;
              }

              var content = file.jsResourceContent != null 
                ? file.jsResourceContent
                : file.outputContent || file.content;

              if (typeof content == 'function')
                content = content.toString().replace(/function\s+anonymous/, 'function');
              else
                content = JSON.stringify(content);

              if (!stat[file.type])
                stat[file.type] = { count: 0, size: 0 };

              stat[file.type].count++;
              stat[file.type].size += content.length;

              res.push([file, file.jsRef, content]);
            }

            fconsole.start('Stat:');
            for (var type in stat)
              fconsole.log('[' + type + '] ' + stat[type].size + ' bytes in ' + stat[type].count + ' resource(s)');
            fconsole.end();

            return '{\n' +
              res.sort(function(a, b){
                var wa = resourceTypeWeight[a[0].type] || 0;
                var wb = resourceTypeWeight[b[0].type] || 0;
                return wa > wb ? 1 : (wa < wb ? -1 : 0);
              }).map(function(item){
                resourceToc.push('[' + (resTypeByFirstChar[item[2].charAt(0)] || 'unknown') + '] ' + item[0].relpath + ' -> ' + item[1]);
                return '"' + item[1] + '":' + item[2]
              }).join(',\n') + 
            '\n}';
          })())[1][0][1][2];
        }
      }
    });
    fconsole.endl();

    if (flow.js.globalVars)
      basisFile.ast[1].unshift(['var', flow.js.globalVars]);
  }

  for (var name in packages)
  {
    var package = packages[name];

    // log package file list
    fconsole.start('Package ' + name + ':');
    package.forEach(function(f){
      fconsole.log(f.relpath);
    });
    fconsole.endl();

    var throwCodes = flow.options.jsBuildMode ? package.reduce(function(res, file){
      res.push.apply(res, file.throwCodes);
      return res;
    }, []).sort(function(a, b){
      return a[0] - b[0];
    }) : [];

    switch (package.layout){
      case 'basis':
        var isCoreFile = basisFile && flow.js.rootNSFile[name] === basisFile; //(flow.options.jsSingleFile || name == 'basis');

        var packageFile = flow.files.add({
          type: 'script',
          outputFilename: name + '.js',
          outputContent: 
            (isCoreFile ? '// resources (' + resourceToc.length + '):\n//  ' + resourceToc.join('\n//  ') + '\n//\n' : '') +
            (throwCodes.length ? '// throw codes:\n//  ' + throwCodes.map(function(item){ return item[0] + ' -> ' + at.translate(item[1]); }).join('\n//  ') + '\n//\n' : '') +
            wrapPackage(
              package.filter(function(file){
                return file != basisFile;
              }),
              flow,
              isCoreFile
                ? at.translate(basisFile.ast)
                : ''
            )
        });

        packages[name].file = packageFile;

        if (isCoreFile)
        {
          packageFile.htmlNode = basisFile.htmlNode;
          delete basisFile.htmlNode;
        }

        break;

      default:
        var htmlNode = null;
        var packageFile = flow.files.add({
          type: 'script',
          outputFilename: name + '.js',
          outputContent: 
            (throwCodes.length ? '// throw codes:\n//  ' + throwCodes.map(function(item){ return item[0] + ' -> ' + at.translate(item[1]); }).join('\n//  ') + '\n//\n' : '') +
            package.map(function(file){
              if (file.htmlNode)
              {
                if (!htmlNode)
                  htmlNode = file.htmlNode;
                else
                  html_at.removeToken(file.htmlNode, true);

                delete file.htmlNode;
              }

              return '//' + file.relpath + '\n' + file.outputContent;
            }).join(';\n\n') + ';'
        });

        packageFile.htmlNode = htmlNode;
        packages[name].file = packageFile;
    }
  }
}
module.exports.handlerName = '[js] Build packages';

//
// wrap package
//

function extractBuildContent(file){
  return '// ' + file.relpath + '\n' +
    '[' +
      '"' + file.namespace + '", ' +
        file.outputContent +
    ']';
}

function extractSourceContent(file){
  return '//\n// ' + file.relpath + '\n//\n' +
    '{\n' +
    '  ns: "' + file.namespace + '",\n' + 
    '  path: "' + path.dirname(file.relpath) + '/",\n' + 
    '  fn: "' + file.basename + '",\n' +
    '  body: function(){\n' +
         file.outputContent + '\n' +
    '  }\n' + 
    '}';
}

var packageWrapper = [
  "(function(){\n" +
  "'use strict';\n\n",

  "\n}).call(this);"
];

var localIdx = 0;
function localizeNames(ast, baseScope, moduleScope){
  function localName(name){
    return name;

    // this -> scope
    var token = this.get(name);
    if (!token)
    {
      console.log(this);
      console.log(name);
    }

    if (!token.rename)
      token.rename = '__local' + localIdx++;

    return token.rename;
    //return '__local' + localIdx++;
    //return '__$' + name;
  }

  return at.walk(ast, {
    '*': function(token){
      switch (token[0])
      {
        case 'defun':
        case 'function':
          if (token[1])
            token[1] = localName.call(this.scope.parent, token[1]);
          token[2] = token[2].map(localName, this.scope);
          break;

        case 'const':
        case 'var':
          var vars = token[1];
          for (var i = 0, v; v = vars[i]; i++)
            v[0] = localName.call(this.scope, v[0]);
          break;
    
        case 'name':
          var name = token[1];

          if (name == 'this')
          {
            if (this.scope === moduleScope)
              token[1] = localName.call(this.scope, 'module');
          }
          else
          {
            var scope = this.scope.scopeByName(name);
            if (scope && scope.level > baseScope.level)
              token[1] = localName.call(this.scope, token[1]);
          }
          break;
      }
    }
  });
}

function wrapPackage(package, flow, contentPrepend){
  if (false && !flow.options.jsBuildMode)
  {
    // source mode
    return [
      '// filelist (' + package.length + '): \n//   ' + package.map(function(file){
        return file.relpath;
      }).join('\n//   ') + '\n',

      packageWrapper[0],
      contentPrepend,

      ';[\n',
        package.map(extractSourceContent).join(',\n'),
      '\n].forEach(' + function(module){
         var path = module.path;    
         var fn = path + module.fn;
         var ns = basis.namespace(module.ns);
         ns.source_ = module.body.toString().replace(/^\s*\(?\s*function[^(]*\([^\)]*\)[^{]*\{|\}\s*\)?\s*$/g, '');
         ns.filename_ = module.path + module.fn;
         new Function('module, exports, global, __filename, __dirname, basis, resource',
           '/** @namespace ' + ns.path + ' */\n' + ns.source_ + '//@ sourceURL=' + fn
         ).call(ns, ns, ns.exports, this, fn, path, basis, function(url){ return basis.resource(path + url) });
         for (var key in ns.exports)
           if (key in ns == false)
             ns[key] = ns.exports[key];
       } + ', this)',

      packageWrapper[1]
    ].join('');
  }


  // build mode
  var res = MERGE ? ['call', ['function', null, [], []], [['name', 'this']]] : localizeNames(flow.js.basisPackageClue.ast, flow.js.basisPackageClue.jsScope);
  var modules = MERGE ? res[1][3] : res[1][0][1][1][1][1];

  if (MERGE)
    package.reduce(function(res, file){
      var fnWrapper = file.ast[1][0];
      var body = fnWrapper[3];

      file.jsScope.names['global'] = [];

      body.unshift(
        ['var', [['global', ['name', 'window']]]],
        ['var', [['basis', ['dot', ['name', 'global'], 'basis']]]],
        ['var', [['module', ['call', ['dot', ['name', 'basis'], 'namespace'], [['string', file.namespace]]]]]],
        ['var', [['exports', ['dot', ['name', 'module'], 'exports']]]],
        ['var', [['__filename', ['string', '']]]], //file.relpath
        ['var', [['__dirname', ['string', '']]]] //path.dirname(file.relpath) + '/'
      );
      body.push(
        ['stat', ['call', ['dot', ['dot', ['name', 'basis'], 'object'], 'complete'], [['name', 'module'], ['dot', ['name', 'module'], 'exports']]]]
      );

      localizeNames(fnWrapper, flow.js.globalScope, file.jsScope);

      res.push.apply(res, body);
      return res;
    }, modules);
  else
    package.reduce(function(res, file){
      var fnWrapper = file.ast[1][0];
      res.push(['array', [['string', file.namespace], fnWrapper]]);
      return res;
    }, modules);

  return [
    '// filelist (' + package.length + '): \n//   ' + package.map(function(file){
      return file.relpath;
    }).join('\n//   ') + '\n',

    packageWrapper[0],
    contentPrepend,

    ';\n',
    at.translate(res),

    packageWrapper[1]
  ].join('');
}
