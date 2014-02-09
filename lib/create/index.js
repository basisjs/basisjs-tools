var fs = require('fs');
var path = require('path');
var command = require('./command');


//
// launched by another module
//
exports.create = function(config){
  if (this instanceof cli.Command)
    throw '!!!not implemented';

  create(command.normalize(config));
};

//
// launched directly (i.e. node index.js ..)
//
if (process.mainModule === module)
  command.run();


//
// main function
//
function create(options){

  options = command.norm(options);

  //
  // init
  //

  var target;
  var output = [];

  switch (options.topic)
  {
    case 'app':
    case 'module':
      target = options.topic == 'app' ? options.output : path.join(options.output, options.name);
      resolveDirPath(target);
      output = [target];

      // if folder exists and not empty - confirm possible file rewrite
      if (fs.readdirSync(target).length)
        commander.confirm('Destination folder is not empty, some files may be overwritten. Continue? (y/n) ', function(yes){
          process.stdin.pause(); // it looks like a hack, commander didn't do it by default
          if (yes)
            createFilesStep()
        });
      else
        createFilesStep();

      break;

    case 'type':
      options.instanceName = options.name.charAt(0).toLowerCase() + options.name.substr(1);
      target = options.output;

      if (!fs.existsSync(target))
      {
        console.warn('Destination folder (' + target + ') does not exists.')
        process.exit();
      }

      createFilesStep();
      
      break;
  }

  function createFilesStep(){
    // create file structure
    console.log('Create file structure ' + target + ':');
    createFiles(options.templateDir, output, {
      name: options.name,
      appName: options.topic == 'app' ? options.name : options.appName,
      appTitle: (options.title || 'My app').replace(/\'/g, '\\\''),
      instanceName: options.instanceName,
      type: options.type,
      l10n: !!options.l10n
    });


    //
    // git
    //

    if (options.topic == 'app')
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
  console.log('Init git repo.')
  require('child_process').spawn(
    'git',
    ['init', path],
    { stdio: 'inherit' }
  ).on('exit', function (code) {
    if (code)
      console.log('\nSome problems here, git exited with code', code);
    else
      cloneBasis(path);
  });
}

function cloneBasis(dir){
  var bower = require('bower');

  console.log('Install basis.js...');
  bower.commands
    .install(['basisjs'], { save: true }, {
      cwd: path.relative('.', dir) || '.',
      directory: path.relative('.', dir + '/lib')
    })
    .on('log', function(log){
      console.log('  ' + log.id + ' ' + log.message);
    })
    .on('end', function(installed){
      console.log('  basis.js installed!');
      console.log('DONE: App created.');
    });
}

function replaceSpecial(str, values){
  return str
    // cut
    .replace(/\{\s*(!!?)\s*([a-z\d_]+)\s*\}(.*(?:\r\n?|\n\r?|$))/ig, function(m, op, name, rest){
      return (op == '!' ? !values[name] : !!values[name]) ? replaceSpecial(rest, values) : '';
    })
    // set value
    .replace(/\{\s*=\s*([a-z\d_]+)\s*\}/ig, function(m, name){
      if (name in values == false)
      {
        console.warn('unknown replace token:', name);
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

function createFiles(input, output, values){
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
      createFiles(infn, output, values);
    }
    else
    {
      console.log(indent(output.length - 1)/* + 'Create file:'*/ + output.slice(1).join('/'));
      fs.writeFileSync(outputfn, replaceSpecial(fs.readFileSync(infn, 'utf-8'), values));
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
      //console.log(curpath, parts[i], fs.existsSync(curpath));
      if (!fs.existsSync(curpath))
      {
        //output.push(parts[i]);
        //console.log(indent(output.length - 1) + parts[i]);
        fs.mkdirSync(curpath);
      }
    }
  }
  return output;
}
