var assert = require('assert');
var cli = require('../../lib/cli');

describe('boolean options', function(){
  var command;

  beforeEach(function(){
    command = cli.create();
  });

  describe('positive', function(){
    it('should be false by default', function(){
      command
        .option('--bool');

      assert(command.values.bool === false);
    });

    it('should throw an exception if oposite option defined already', function(){
      assert.throws(function(){
        command
          .option('--no-bool')
          .option('--bool');
      });
    });

    it('should be true if option present', function(){
      command
        .option('--bool');

      command.run(['--bool']);
      assert(command.values.bool === true);
    });

    it('should throw an exception for inverted option', function(){
      command
        .option('--bool');

      assert.throws(function(){
        command.run(['--no-bool']);
      });
    });

    it('process function should receive true', function(){
      var actionValue;
      command
        .option('--bool', 'description', function(value){
          actionValue = value;
        });

      command.run(['--bool']);

      assert(actionValue === true);
    });

    it('process function result should be ignored', function(){
      command
        .option('--bool', 'description', function(value){
          return false;
        });

      command.run(['--bool']);

      assert(command.values.bool === true);
    });
  });


  describe('negative', function(){
    it('should be true by default', function(){
      command
        .option('--no-bool');

      assert(command.values.bool === true);
    });

    it('should throw an exception if oposite option defined already', function(){
      assert.throws(function(){
        command
          .option('--bool')
          .option('--no-bool');
      });
    });

    it('should be false if option present', function(){
      command
        .option('--no-bool');

      command.run(['--no-bool']);
      assert(command.values.bool === false);
    });

    it('should throw an exception for non-inverted option', function(){
      command
        .option('--no-bool');

      assert.throws(function(){
        command.run(['--bool']);
      });
    });

    it('process function should receive false', function(){
      var actionValue;
      command
        .option('--no-bool', 'description', function(value){
          actionValue = value;
        });

      command.run(['--no-bool']);

      assert(actionValue === false);
    });

    it('process function result should be ignored', function(){
      command
        .option('--no-bool', 'description', function(value){
          return true;
        });

      command.run(['--no-bool']);

      assert(command.values.bool === false);
    });
  });
});
