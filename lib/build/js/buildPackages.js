
var path = require('path');
var at = require('../../ast').js;
var html_at = require('../../ast').html;

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
        var name = at.resolveName(token, true);

        if (!inserted && name == 'this.__resources__' || name == 'global.__resources__')
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

    switch (package.layout){
      case 'basis':
        var isCoreFile = basisFile && flow.js.rootNSFile[name] === basisFile; //(flow.options.jsSingleFile || name == 'basis');
        var throwCodes = package.reduce(function(res, file){
          res.push.apply(res, file.throwCodes);
          return res;
        }, []);

        var packageFile = flow.files.add({
          type: 'script',
          outputFilename: name + '.js',
          outputContent: 
            (isCoreFile ? '// resources (' + resourceToc.length + '):\n//  ' + resourceToc.join('\n//  ') + '\n//\n' : '') +
            (throwCodes.length ? '// throw codes:\n//  ' + throwCodes.map(function(item){ return item[0] + ' -> ' + at.translate(item[1]) }).join('\n//  ') + '\n//\n' : '') +
            wrapPackage(package.filter(function(file){ return file != basisFile }), flow, isCoreFile ? at.translate(basisFile.ast) : '')
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
          outputContent: package.map(function(file){
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
      '"' + file.namespace + '", function(basis, module, exports, resource, global, __dirname, __filename){' +
        file.outputContent +
      '}' + 
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

function wrapPackage(package, flow, contentPrepend){
  return !flow.options.jsBuildMode
    // source mode
    ? [
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
      ].join('')
    // build mode
    : [
        '// filelist (' + package.length + '): \n//   ' + package.map(function(file){
          return file.relpath;
        }).join('\n//   ') + '\n',

        packageWrapper[0],
        contentPrepend,

        ';[\n',
          package.map(extractBuildContent).join(',\n'),
        '].forEach(' + function(module){
           var fn = module[1];
           var ns = basis.namespace(module[0]);
           // basis, module, exports, resource, global, __dirname, __filename
           fn.call(ns, basis, ns, ns.exports, basis.resource, this, "", "");
           for (var key in ns.exports)
             if (key in ns == false)
               ns[key] = ns.exports[key];
         } + ', this)',

        packageWrapper[1]
      ].join('');
}
