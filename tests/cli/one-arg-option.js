var assert = require('assert');
var cli = require('../../lib/cli');

describe('one arg options', function(){
  var command;

  beforeEach(function(){
    command = cli.create();
  });

  describe('required option', function(){
    it('should not be in values by default', function(){
      command
        .option('--option <arg>');

      assert('option' in command.values === false);
      assert(command.hasOption('option'));
    });

    it('should store default value', function(){
      command
        .option('--option <arg>', 'description', 123);

      assert(command.values.option === 123);
    });

    it('default value should be wrapped by normalize function', function(){
      command
        .option('--option <arg>', 'description', function(value){ return value * 2; }, 123);

      assert(command.values.option === 246);
    });

    it('should not be in values when normalize function preset but no default value', function(){
      command
        .option('--option <arg>', 'description', function(value){ return 123; });

      assert('option' in command.values === false);
    });

    it('should read only one argument', function(){
      var ok = false;
      command
        .option('--option <arg>', 'description')
        .command('test')
          .action(function(){
            ok = true;
          });

      command.parse(['--option', '1', 'test']);
      assert(command.values.option === '1');
      assert(ok === true);
    });

    it('should ignore commands', function(){
      var ok = true;
      command
        .option('--option <arg>', 'description')
        .command('test')
          .action(function(){
            ok = false;
          });

      command.parse(['--option', 'test']);
      assert(command.values.option === 'test');
      assert(ok === true);
    });

    it('should be exception if arg is not specified (no more arguments)', function(){
      command
        .option('--option <arg>', 'description');

      assert.throws(function(){
        command.parse(['--option']);
      });
    });

    it('should be exception if arg is not specified (another option next)', function(){
      command
        .option('--test')
        .option('--option <arg>', 'description');

      assert.throws(function(){
        command.parse(['--option', '--test']);
      });
    });

    it('#setOption should wrap new value', function(){
      command
        .option('--option <arg>', 'description', function(value){ return value * 2 });

      command.setOption('option', 123);
      assert(command.values.option === 246);
    });
  });

  describe('optional option', function(){
    it('should not be in values by default', function(){
      command
        .option('--option [arg]');

      assert('option' in command.values === false);
      assert(command.hasOption('option'));
    });

    it('should store default value', function(){
      command
        .option('--option [arg]', 'description', 123);

      assert(command.values.option === 123);
    });

    it('default value should be wrapped by normalize function', function(){
      command
        .option('--option [arg]', 'description', function(value){ return value * 2; }, 123);

      assert(command.values.option === 246);
    });

    it('should not be in values when normalize function preset but no default value', function(){
      command
        .option('--option [arg]', 'description', function(value){ return 123; });

      assert('option' in command.values === false);
    });

    it('should read only one argument', function(){
      var ok = false;
      command
        .option('--option [arg]', 'description')
        .command('test')
          .action(function(){
            ok = true;
          });

      command.parse(['--option', '1', 'test']);
      assert(command.values.option === '1');
      assert(ok === true);
    });

    it('should ignore commands', function(){
      var ok = true;
      command
        .option('--option [arg]', 'description')
        .command('test')
          .action(function(){
            ok = false;
          });

      command.parse(['--option', 'test']);
      assert(command.values.option === 'test');
      assert(ok === true);
    });

    it('should not be exception if arg is not specified (no more arguments)', function(){
      command
        .option('--option [arg]', 'description');

      assert.doesNotThrow(function(){
        command.parse(['--option']);
      });
    });

    it('should not be exception if arg is not specified (another option next)', function(){
      command
        .option('--test')
        .option('--option [arg]', 'description');

      assert.doesNotThrow(function(){
        command.parse(['--option', '--test']);
      });
    });

    it('#setOption should wrap new value', function(){
      command
        .option('--option [arg]', 'description', function(value){ return value * 2 });

      command.setOption('option', 123);
      assert(command.values.option === 246);
    });
  });
});
