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

    fconsole.start('Build resource map');
    var resourceAst = (function(){
      var res = [];
      //var stat = {};
      var resourceTypeWeight = {
        'json': 1,
        'template': 2,
        'l10n': 3,
        'script': 100
      };

      for (var jsRef in flow.js.resourceMap)
      {
        var file = flow.js.resourceMap[jsRef];
        var ast = file.type == 'script' && file.ast ? file.ast[1][0] : null;

        // if (!file.jsRefCount && file.type == 'template')
        // {
        //   fconsole.log('[i] Drop resource:', file.relpath);
        //   continue;
        // }

        if (!ast)
        {
          var content = file.jsResourceContent != null
            ? file.jsResourceContent
            : file.outputContent || file.content;

          switch (typeof content)
          {
            case 'string':
              ast = ['string', content];
              break;
            default:
              if (typeof content == 'function')
                content = content.toString().replace(/function\s+anonymous/, 'function');
              else
                content = JSON.stringify(content);

              ast = at.parse('0,' + content, true)[2];
          }
        }

        // if (!stat[file.type])
        //   stat[file.type] = { count: 0, size: 0 };

        // stat[file.type].count++;
        // stat[file.type].size += content.length;

        res.push({
          relpath: file.relpath,
          type: file.type,
          ref: file.jsRef,
          ast: ast
        });
      }

      // fconsole.start('Stat:');
      // for (var type in stat)
      //   fconsole.log('[' + type + '] ' + stat[type].size + ' bytes in ' + stat[type].count + ' resource(s)');
      // fconsole.end();

      res = ['object', res.sort(function(a, b){
        var wa = resourceTypeWeight[a.type] || 0;
        var wb = resourceTypeWeight[b.type] || 0;
        return wa > wb ? 1 : (wa < wb ? -1 : 0);
      }).map(function(item){
        resourceToc.push('[' + (item.ast[0] || 'unknown') + '] ' + item.relpath + ' -> ' + item.ref);
        return [item.ref, item.ast];
      })];

      return res;
    })();
    fconsole.endl();

    fconsole.start('Inject resource map');
    if (flow.js.oldBasis)
    {
      basisFile.ast = at.walk(basisFile.ast, {
        'dot': function(token){
          var expr = token[1];
          var isRequiredHost = token[1][0] == 'name' && (token[1][1] == 'this' || token[1][1] == '__local6' || this.scope.resolve(token[1]) === this.scope.root.get('global'));

          // this.__resources__ || global.__resources__
          if (!inserted && isRequiredHost && token[2] == '__resources__')
          {
            inserted = true;
            return resourceAst;
          }
        }
      });
    }
    else
    {
      var stat = at.parse('var __resources__ = {};');
      stat[1][0][1][0][1] = resourceAst; // replace {} for resource map
      at.prepend(basisFile.ast, stat);

      if (basisFile.config.noConflict)
      {
        var rootNamespaces = Object.keys(flow.js.rootNSFile).filter(function(name){ return name != 'basis'; });
        if (rootNamespaces.length)
        {
          fconsole.start('Inject noConflict namespaces: ' + rootNamespaces);

          fconsole.log('Patch getRootNamespace');
          var getRootNamespaceToken = basisFile.jsScope.get('getRootNamespace').token;
          var getRootNamespaceFirstArg = getRootNamespaceToken[2][0];

          var rootNsAssignCode = at.parse(rootNamespaces.map(function(name){
            return 'if (' + getRootNamespaceFirstArg + ' == "' + name + '" && !' + name + ')' +
              name + ' = namespaces[' + getRootNamespaceFirstArg + '];';
          }).join(''))[1];

          Array.prototype.splice.apply(getRootNamespaceToken[3], [getRootNamespaceToken[3].length - 1, 0].concat(rootNsAssignCode));

          fconsole.log('Add root namespace declation');
          at.prepend(basisFile.ast, at.parse('var ' + rootNamespaces + ';'));

          fconsole.endl();
        }
      }
    }
    fconsole.endl();

    // replace config init
    fconsole.log('Replace config');
    if (!flow.js.oldBasis && flow.js.autoload)
      basisFile.config.autoload = './' + flow.js.autoload.file.jsRef; // replace namespace for it's filename in resource map
    var configToken = basisFile.jsScope.get('config').token;
    Array.prototype.splice.apply(configToken, [0, 10].concat(at.parse('0,' + JSON.stringify(basisFile.config))[1][0][1][2]));

    // inject global vars
    if (flow.js.globalVars)
      basisFile.ast[1].unshift(['var', flow.js.globalVars]);
  }

  var scriptSequenceId = basisFile ? 1 : 0;
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
          outputFilename: isCoreFile ? 'script.js' : name + '.js',
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
          outputFilename: 'script' + (scriptSequenceId++) + '.js',
          outputContent:
            '// filelist:\n' +
            package.map(function(file){
              return '//   ' + file.relpath;
            }).join('\n') + '\n//\n' +
            (throwCodes.length ? '// throw codes:\n//  ' + throwCodes.map(function(item){ return item[0] + ' -> ' + at.translate(item[1]); }).join('\n//  ') + '\n//\n' : '') +
            '\n' +

            package.map(function(file){
              if (file.htmlNode)
              {
                if (!htmlNode)
                  htmlNode = file.htmlNode;
                else
                  html_at.removeToken(file.htmlNode, true);

                delete file.htmlNode;
              }

              return '// [' + file.relpath + ']\n' + file.outputContent;
            }).join(';\n\n') + ';'
        });

        packageFile.htmlNode = htmlNode;
        packages[name].file = packageFile;
    }
  }
};

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
  '(function(){\n' +
  '"use strict";\n\n',

  '\n}).call(this);'
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
//console.log(flow.js.oldBasis);
//process.exit();


  return [
    '// filelist (' + package.length + '): \n//   ' + package.map(function(file){
      return file.relpath;
    }).join('\n//   ') + '\n',

    packageWrapper[0],

    'var __namespace_map__ = ' + JSON.stringify(flow.js.fn2ns) + ';\n',

    !flow.js.oldBasis
      ? contentPrepend
        // for old basis.js (prior 0.10.0)
      : contentPrepend.replace('(requestUrl)', '(__ns2fn[namespace] || requestUrl)') +  // this is dirty patch for old basis.js versions (prior to 0.10)
        '\n' +
        'var __ns2fn = {};' +
        'var __fn2ns = {};' +
        'basis.require = (' + (function(map){
          var _require = basis.require;

          for (var key in basis.config.path)
            basis.config.path[key] = basis.path.resolve(basis.config.path[key]) || '/';

          for (var key in map)
          {
            var fn = basis.path.resolve(key);
            __fn2ns[fn] = map[key];
            __ns2fn[map[key]] = fn;
          }

          return function(fn){
            return _require(__fn2ns[basis.path.resolve(fn)]);
          };
        }).toString() + ')(__namespace_map__);' +
        (flow.js.autoload ? 'basis.require("' + flow.js.autoload.file.jsRef + '");' : ''),

    packageWrapper[1]
  ].join('');
}
