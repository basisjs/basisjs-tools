var program = require('../../lib/cli.js');
var path = require('path');
var assert = require('assert');

var files_1_3 = [
  'app/index.html',

  'app/lib/basis.js',
  'app/lib/basis/event.js',
  'app/lib/basis/l10n.js',
  'app/lib/basis/template.js',

  'app/root/asset.js',
  'app/root/require.js',
  'app/root/resource.js',
  'app/root/explicit.l10n',
  'app/root/implicit.l10n',
  'app/root/image.svg',
  'app/root/attr-style-image.svg',

  'app/index/after-basis-script.js',
  'app/index/after-basis-script-require.js',
  'app/index/after-basis-script-resource.js',
  'app/index/inline-script-require.js',
  'app/index/inline-script-resource.js',
  'app/index/icon.svg',
  'app/index/shortcut-icon.svg',
  'app/index/apple-touch-icon.svg',
  'app/index/apple-touch-icon-precomposed.svg',
  'app/index/apple-touch-startup-image.svg',
  'app/index/image.svg',
  'app/index/link-unknown-rel-image.svg',
  'app/index/attr-style-image.svg',
  'app/index/link-style.css',
  'app/index/link-style-image.svg',
  'app/index/notype-script.js',
  'app/index/script.js',
  'app/index/style-image.svg',
  'app/index/style-import.css',
  'app/index/style-import-image.svg',

  'app/src/app.js',
  'app/src/require.js',
  'app/src/resource.js',
  'app/src/explicit.l10n',
  'app/src/implicit.l10n',
  'app/src/app.l10n',

  'app/src/template/rel.tmpl',
  'app/src/template/rel.css',
  'app/src/template/rel.svg',
  'app/src/template/rel-import.css',
  //'/src/template/rel-include.tmpl', // as included only via <b:include>
  'app/src/template/rel-include.css',
  'app/src/template/rel-include.l10n',
  'app/src/template/rel-explicit.l10n',

  'app/ns/basisrequire.js',
  'app/ns/require.js',
  'app/ns/index.js',

  'app/unknownns/basisrequire.js',
  'app/unknownns/require.js',
  'app/unknownns.js'
];
var files_1_4 = [
  'app/src/template/ns.tmpl',
  'app/src/asset.js',

  //'/ns/b-include.tmpl', // as included only via <b:include>
  'app/ns/basisresource.js',
  'app/ns/b-include.css',
  'app/ns/b-include-import.css',
  'app/ns/b-include.svg',
  'app/ns/basis-asset.json',
  'app/ns/ns-require.js',
  'app/ns/resource.js',
  'app/ns/template.tmpl',
  'app/ns/asset.json',
  'app/ns/b-l10n.l10n',
  'app/ns/dictionary.l10n',
  'app/ns/ns-basisrequire.js',
  'app/ns/style.css',

  'app/unknownns/basis-asset.json',
  'app/unknownns/asset.json',
  'app/unknownns/basisresource.js',
  'app/unknownns/ns-require.js',
  'app/unknownns/resource.js',
  'app/unknownns/dictionary.l10n',
  'app/unknownns/ns-basisrequire.js'
];

function fileWarnings(flow){
  return flow.files.warns.map(function(w){
    return w.message;
  });
}

function checkFileGraph(flow, expected, baseURI){
  if (!flow)
    return 'no extract result';

  expected = expected.map(function(fn){
    return '/' + path.relative(flow.options.base, path.resolve(baseURI, fn)).replace(/\\/g, '/');
  }).sort();

  var actual = flow.files.queue.map(function(file){
    return file.filename;
  }).filter(Boolean).sort();

  var missedFiles = expected.filter(function(fn){
    return actual.indexOf(fn) == -1;
  });
  var extraFiles = actual.filter(function(fn){
    return expected.indexOf(fn) == -1;
  });

  if (missedFiles.length || extraFiles.length || flow.files.warns.length)
    return (
      (missedFiles.length ? '\nmissed files: ' + missedFiles.join(', ') : '') +
      (extraFiles.length ? '\nextra files: ' + extraFiles.join(', ') : '') +
      (flow.files.warns.length ? '\nwarnings:\n  ' + fileWarnings(flow).join('\n  ') : '')
    );

  return false;
}

describe('extract file graph', function(){
  //
  // basis.js 1.3
  //
  describe('basis.js 1.3', function(){
    var envPath = __dirname + '/env/basis1.3';
    var files = files_1_3;

    it('cwd is upward index.html location', function(){
      var baseURI = envPath;
      process.env.PWD = baseURI;

      var flow = program.run(['extract', '--target', 'none', '--silent']);
      var warnings = checkFileGraph(flow, files, envPath);

      assert(warnings === false, warnings);
    });

    it('cwd is index.html location', function(){
      var baseURI = envPath + '/app';
      process.env.PWD = baseURI;

      var flow = program.run(['extract', '--target', 'none', '--silent']);
      var warnings = checkFileGraph(flow, files, envPath);

      assert(warnings === false, warnings);
    });

    it('cwd is nested index.html dir', function(){
      var baseURI = envPath + '/app/src';
      process.env.PWD = baseURI;

      var flow = program.run(['extract', '--target', 'none', '--silent']);
      var warnings = checkFileGraph(flow, files, envPath);

      assert(warnings === false, warnings);
    });
  });

  //
  // basis.js 1.4
  //
  describe('basis.js 1.4', function(){
    var envPath = __dirname + '/env/basis1.4';
    var files = files_1_3.concat(files_1_4);

    it('cwd is upward index.html location', function(){
      var baseURI = envPath;
      process.env.PWD = baseURI;

      var flow = program.run(['extract', '--target', 'none', '--silent']);
      var warnings = checkFileGraph(flow, files, envPath);

      assert(warnings === false, warnings);
    });

    it('cwd is index.html location', function(){
      var baseURI = envPath + '/app';
      process.env.PWD = baseURI;

      var flow = program.run(['extract', '--target', 'none', '--silent']);
      var warnings = checkFileGraph(flow, files, envPath);

      assert(warnings === false, warnings);
    });

    it('cwd is nested index.html dir', function(){
      var baseURI = envPath + '/app/src';
      process.env.PWD = baseURI;

      var flow = program.run(['extract', '--target', 'none', '--silent']);
      var warnings = checkFileGraph(flow, files, envPath);

      assert(warnings === false, warnings);
    });
  });
});
