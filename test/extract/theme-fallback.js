var program = require('../../lib/cli.js');
var path = require('path');
var assert = require('assert');

var themeOrder = ['base', 'app', 'touch'];
var names = [
  'base',
  'base-override-app',
  'base-override-touch',
  'base-override-app-touch',
  'app_base-override-app',
  'app_base-override-app-touch',
  'app',
  'app-override-touch',
  'touch_base-override-touch',
  'touch_app-override-touch',
  'touch_base-override-app-touch',
  'touch'
];

var files = names.reduce(function(res, name){
  return res.concat('./src/' + name + '.tmpl', './src/' + name + '.css');
}, []);

function assertFileGraph(flow, expected, baseURI){
  if (!flow)
    return 'no extract result';

  expected = expected.map(function(fn){
    return '/' + path.relative(flow.options.base, path.resolve(baseURI, fn)).replace(/\\/g, '/');
  }).sort();

  var actual = flow.files.queue.map(function(file){
    var filename = file.filename;
    if (filename && (path.extname(filename) == '.css' || path.extname(filename) == '.tmpl'))
      return filename;
  }).filter(Boolean).sort();

  var missedFiles = expected.filter(function(fn){
    return actual.indexOf(fn) == -1;
  });
  var extraFiles = actual.filter(function(fn){
    return expected.indexOf(fn) == -1;
  });

  if (missedFiles.length || extraFiles.length || flow.files.warns.length)
    assert(false,
      (missedFiles.length ? '\nmissed files: ' + missedFiles.join(', ') : '') +
      (extraFiles.length ? '\nextra files: ' + extraFiles.join(', ') : '') +
      (flow.files.warns.length ? '\nwarnings:\n  ' + fileWarnings(flow).join('\n  ') : '')
    );

  return false;
}


describe('template fallback', function(){
  var flowPromise;

  before(function(){
    process.env.PWD = path.resolve(__dirname, 'theme-fallback');
    flowPromise = program.run(['extract', '--target', 'none', '--silent']);
  });

  it('should find all files', function(){
    return flowPromise.then(function(flow){
      assertFileGraph(flow, files, process.env.PWD);
    });
  });

  describe('theme style distribution', function(){
    var themes;

    before(function(){
      return flowPromise.then(function(flow){
        themes = {};
        flow.files.queue.forEach(function(file){
          if (file.type == 'style')
            themes[file.filename.replace(/^.*\/|\.css$/g, '')] = file.themes.sort(function(a, b){
              return themeOrder.indexOf(a) - themeOrder.indexOf(b);
            });
        });
      });
    });

    // base
    it('base only style should be included to every theme (base)', function(){
      assert.equal(themes['base'].join(' '), 'base app touch');
    });

    it('every theme overrided style should present only in base theme (base-override-app-touch)', function(){
      assert.equal(themes['base-override-app-touch'].join(' '), 'base');
    });

    it('middle theme overrided style by should present only in base theme (base-override-app)', function(){
      assert.equal(themes['base-override-app'].join(' '), 'base');
    });

    it('last theme overrided style should be included to every theme except last one (base-override-touch)', function(){
      assert.equal(themes['base-override-touch'].join(' '), 'base app');
    });

    // app
    it(' (app)', function(){
      assert.equal(themes['app'].join(' '), 'app touch');
    });

    it(' (app_base-override-app)', function(){
      assert.equal(themes['app_base-override-app'].join(' '), 'app touch');
    });

    it(' (app_base-override-app-touch)', function(){
      assert.equal(themes['app_base-override-app-touch'].join(' '), 'app');
    });

    it(' (app-override-touch)', function(){
      assert.equal(themes['app-override-touch'].join(' '), 'app');
    });

    // touch
    it(' (touch)', function(){
      assert.equal(themes['touch'].join(' '), 'touch');
    });

    it(' (touch_base-override-touch)', function(){
      assert.equal(themes['touch_base-override-touch'].join(' '), 'touch');
    });

    it(' (touch_app-override-touch)', function(){
      assert.equal(themes['touch_app-override-touch'].join(' '), 'touch');
    });

    it(' (touch_base-override-app-touch)', function(){
      assert.equal(themes['touch_base-override-app-touch'].join(' '), 'touch');
    });
  });
});
