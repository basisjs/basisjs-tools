var fs = require('fs');
var path = require('path');
var clap = require('clap');
var spawn = require('win-spawn');
var command = require('./command');
var exit = require('exit');


//
// launched by another module
//
exports.create = function(topic, config){
  if (this === command ||
      this === command.commands.app ||
      this === command.commands.module ||
      this === command.commands.type)
    create(topic, config);

  if (this === exports)
    create(topic, command.commands[topic].normalize(config));
};

//
// launched directly (i.e. node index.js ..)
//
if (process.mainModule === module)
  command.run();


//
// main function
//
function create(topic, options){

  options.topic = topic;
  options = command.norm(options);

  //
  // init
  //

  var target;
  var output = [];

  switch (topic)
  {
    case 'app':
    case 'module':
      target = topic == 'app' ? options.output : path.join(options.output, options.name);
      resolveDirPath(target);
      output = [target];

      // if folder exists and not empty - confirm possible file rewrite
      if (fs.readdirSync(target).length)
        clap.confirm('Destination folder is not empty, some files may be overwritten. Continue? (y/n) ', function(yes){
          if (yes)
          {
            console.log();
            mainTask();
          }
        });
      else
        mainTask();

      break;

    case 'type':
      options.instanceName = options.name.charAt(0).toLowerCase() + options.name.substr(1);
      target = options.output;
      output = [target];

      if (!fs.existsSync(target))
      {
        console.error('Destination folder (' + target + ') does not exists.');
        exit(2);
      }

      mainTask();

      break;
  }

  function mainTask(){
    // resolve template dir
    for (var i = 0; i < options.templates.length; i++)
    {
      var templatePath = path.normalize(options.templates[i] + '/' + topic + '/' + options.template) + '/';
      if (fs.existsSync(templatePath))
      {
        console.log('Use template from path: ' + templatePath);
        options.templateDir = templatePath;
        break;
      }
    }

    if (!options.templateDir)
    {
      console.error(topic + ' template ' + options.template + ' not found!\nPaths for search:\n  ' + options.templates.join('\n  '));
      exit(2);
    }

    // create file structure
    console.log('Create file structure: ' + target);
    createFiles(options.templateDir, output, {
      name: options.name,
      appName: topic == 'app' ? options.name : options.appName,
      appTitle: (options.title || 'My app').replace(/\'/g, '\\\''),
      instanceName: options.instanceName,
      type: options.type,
      l10n: !!options.l10n,
      git: options.git
    }, options);
    console.log();

    // git init & basis install
    if (topic == 'app')
    {
      if (options.git)
        initGitRepo(target);
      else
        cloneBasis(target);
    }
  }
}


//
// tools
//

function initGitRepo(path){
  console.log('Init git repo...');

  spawn(
    'git',
    ['init', path],
    { stdio: 'inherit' }
  ).on('exit', function(code){
    if (code)
      return console.error('\nSome problems here, git exited with code', code);

    console.log();
    cloneBasis(path);
  });
}

function cloneBasis(dir){
  console.log('Install basis.js...');

  process.chdir(dir);
  spawn(
    'npm',
    ['install', 'basisjs', '--save'],
    { stdio: 'inherit' }
  ).on('exit', function(code){
    if (code)
      return console.error('\nSome problems here, npm exited with code', code);

    console.log();
    console.log('DONE: App created.');
  });
}

function replaceSpecial(str, values, fn){
  if (fn)
  {
    var values_ = values;
    values = {};
    for (var key in values_)
      values[key] = values_[key];
    values.filename = fn;
    values.dirname = path.dirname(fn);
  }

  return str
    // cut
    .replace(/\{\s*(!!?)\s*([a-z\d_]+)\s*\}(.*(?:\r\n?|\n\r?|$))/ig, function(m, op, name, rest){
      return (op == '!' ? !values[name] : !!values[name]) ? replaceSpecial(rest, values) : '';
    })
    // set value
    .replace(/\{\s*=\s*([a-z\d_]+)\s*\}/ig, function(m, name){
      if (name in values == false)
      {
        console.warn('Unknown replace token:', name);
        return m;
      }
      else
        return values[name];
    });
}

function indent(level){
  var res = [];
  for (var i = 0; i < level; i++)
    res.push('  ');
  return res.join('');
}

function createFiles(input, output, values, options){
  var list = fs.readdirSync(input);
  for (var i = 0, fn; fn = list[i]; i++)
  {
    var infn = input + '/' + fn;
    var outputfn = replaceSpecial(fn, values);
    var stat = fs.statSync(infn);

    if (!outputfn)
      continue;

    output.push(outputfn);
    outputfn = output.join('/');

    if (stat.isDirectory())
    {
      console.log(indent(output.length - 1)/* + 'Create path:'*/ + output.slice(1).join('/'));
      if (!fs.existsSync(outputfn))
        fs.mkdirSync(outputfn);
      createFiles(infn, output, values, options);
    }
    else
    {
      console.log(indent(output.length - 1)/* + 'Create file:'*/ + output.slice(1).join('/'));
      fs.writeFileSync(outputfn, replaceSpecial(fs.readFileSync(infn, 'utf-8'), values, path.relative(options.base, outputfn)));
    }

    output.pop();
  }
}

function resolveDirPath(dir){
  var dirpath = path.normalize(dir + path.sep);
  var output = [];
  if (!fs.existsSync(dirpath))
  {
    var parts = dirpath.split(path.sep);
    var curpath = parts[0] + path.sep;
    for (var i = 1; i < parts.length; i++)
    {
      curpath += parts[i] + path.sep;
      if (!fs.existsSync(curpath))
        fs.mkdirSync(curpath);
    }
  }
  return output;
}
