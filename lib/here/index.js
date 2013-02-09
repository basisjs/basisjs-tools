var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var commander = require('commander');

var moduleOptions = require('./options');
var command = moduleOptions.command;
var replaceTokens = {};

//
// export
//

exports.here = here;
exports.options = moduleOptions;
exports.command = function(args, config){
  return command(args, config, here);
};

//
// if launched directly, run builder
//
if (process.mainModule === module)
  command(null, null, here);

//
// main function
//

function here(options){
  options = moduleOptions.norm(options);

  // check current location is a basis.js repo
  if (fs.existsSync('.git/config'))
    checkForBasisRepo();
  else
  {
    if (fs.existsSync('basisjs'))
    {
      var basisjsPath = path.resolve('basisjs');
      isPathBasisRepo(basisjsPath, function(){
        console.log('I found basis.js repo on current location:', basisjsPath);
        commander.confirm('Should I set BASISJS_PATH to that dir? (y/n) ', function(yes){
          process.stdin.pause(); // it looks like a hack, commander didn't do it by default
          if (yes)
            setBasisjsEnv(basisjsPath);
          else
            console.log('Exit, nothing to do');
        });
      }, function(error){
        console.log('I found basisjs folder on current location, but it\'s not a basis.js repo. Delete it first and try again.', error);
      });
    }
    else
      checkForEnv();
  }
}

function isPathBasisRepo(path, success, fault){
  var cwd = process.cwd();

  if (cwd != path)
  {
    if (!fs.existsSync(path))
      return fault('Path `' + path + '` is not exists');

    try {
      process.chdir(path);
    } catch(e){
      return fault('Error on changing dir to ' + path);
    }
  }

  if (!fs.existsSync('.git/config'))
    return fault('Path `' + path + '` is not a git repo');

  var cp = exec('git remote -v', function(error, stdout, stderr){
    if (cwd != path)
      process.chdir(cwd);

    if (error)
      return console.log('\nSome problems here, git exited with error', error);

    if (stderr)
      return console.log('\nSome problems here, stderr', stderr);

    var isBasisjsRepo = stdout && /https?:\/\/github.com\/basisjs\/basisjs(\.git)?\s+\(fetch\)/.test(stdout);

    if (isBasisjsRepo)
      success();
    else
      fault();
  });
}

function checkForBasisRepo(){
  console.log('Check current location...');

  isPathBasisRepo(process.cwd(), function(){
    console.log('basis.js repo found!');
    setBasisjsEnv(process.cwd());
  }, function(error){
    console.log(error || 'Current path is not basis.js repo');
    askCloneFromGithub();
  });
}

function checkForEnv(){
  if ('BASISJS_PATH' in process.env)
  {
    console.log('BASISJS_PATH found: ', process.env.BASISJS_PATH);
    isPathBasisRepo(process.env.BASISJS_PATH, function(){
      commander.confirm('Should I clone basis.js from that path? (y/n) ', function(yes){
        process.stdin.pause(); // it looks like a hack, commander didn't do it by default
        if (yes)
          cloneBasis(process.env.BASISJS_PATH);
        else
          askCloneFromGithub();
      });
    }, function(error){
      console.log(error || 'Path `' + process.env.BASISJS_PATH + '` is not basis.js repo');
      askCloneFromGithub();
    });
  }
  else
  {
    console.log('BASISJS_PATH not found');
    askCloneFromGithub();
  }
}

function askCloneFromGithub(){
  commander.confirm('Should I clone basis.js from github.com? (y/n) ', function(yes){
    process.stdin.pause(); // it looks like a hack, commander didn't do it by default
    if (yes)
      cloneBasis();
    else
      console.log('Exit, nothing to do');
  });
}

function cloneBasis(path){
  spawn(
    'git',
    ['clone', path || 'http://github.com/basisjs/basisjs', 'basisjs'],
    { stdio: 'inherit' }
  ).on('exit', function (code) {
    if (code)
      console.log('\nSome problems here, git exited with code', code);
    if (!path)
      setBasisjsEnv(process.cwd() + '/basisjs');
  });
}

function setBasisjsEnv(path){
  var cmd;

  switch (process.platform)
  {
    case 'win32':
      cmd = 'setx BASISJS_PATH "' + path + '"';
      break;
    default:
      cmd = 'export BASISJS_PATH=' + path;
  }

  console.log('setting BASISJS_PATH to ' + path);
  exec(cmd, function(error, stdout, stderr){
    if (error)
      return console.log('\nSome problems here, exit with error', error);

    if (stderr)
      return console.log('\nSome problems here, stderr', stderr);

    console.log('\nBASISJS_PATH set successful to ' + path + ', restart your command line interface');
  });
}
