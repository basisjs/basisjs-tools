var assert = require('assert');
var cli = require('../../lib/cli');

describe('names', function(){
  var command;

  beforeEach(function(){
    command = cli.create();
  });

  it('bool option should be in values, options and long', function(){
    command
      .option('--bool');

    assert('bool' in command.values);
    assert('bool' in command.options);
    assert('bool' in command.long);
    assert(command.hasOption('bool'));

    assert('no-bool' in command.values === false);
    assert('no-bool' in command.options === false);
    assert('no-bool' in command.long === false);
    assert(command.hasOption('no-bool') === false);
  });

  it('inverted bool option should be in values and options as normal name and as is in long', function(){
    command
      .option('--no-bool');

    assert('bool' in command.values);
    assert('bool' in command.options);
    assert('no-bool' in command.long);
    assert(command.hasOption('bool'));

    assert('no-bool' in command.values === false);
    assert('no-bool' in command.options === false);
    assert('no-bool' in command.long === true);
    assert(command.hasOption('no-bool') === false);
  });

  it('dasherized option should store as camelName in options', function(){
    command
      .option('--bool-option');

    assert('boolOption' in command.values);
    assert('boolOption' in command.options);
    assert('bool-option' in command.long);
    assert(command.hasOption('boolOption'));

    assert('bool-option' in command.values === false);
    assert('bool-option' in command.options === false);
    assert('boolOption' in command.long === false);
    assert(command.hasOption('bool-option') === false);
  });

  it('non-bool option should have name as is', function(){
    command
      .option('--no-bool <arg>');

    assert('noBool' in command.values === false);
    assert('noBool' in command.options);
    assert('no-bool' in command.long);
    assert(command.hasOption('noBool'));

    assert('bool' in command.values === false);
    assert('bool' in command.options === false);
    assert('bool' in command.long === false);
    assert(command.hasOption('bool') === false);
  });

  it('should be exception if no long form', function(){
    assert.throws(function(){
      command
        .option('-b');
    });
  });

  it('#hasOption should not resolve option name by long form', function(){
    command
      .option('--long-form');

    assert(command.hasOption('long-form') === false);
  });

  it('#hasOption should resolve option name by camelName', function(){
    command
      .option('--long-form');

    assert(command.hasOption('longForm'));
  });
});
