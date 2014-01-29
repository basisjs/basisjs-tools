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

      command.parse(['--bool']);
      assert(command.values.bool === true);
    });

    it('should throw an exception for inverted option', function(){
      command
        .option('--bool');

      assert.throws(function(){
        command.parse(['--no-bool']);
      });
    });

    it('action should receive true', function(){
      var actionValue;
      command
        .option('--bool', 'description', function(value){
          actionValue = value;
        });

      command.parse(['--bool']);

      assert(actionValue === true);
    });

    it('action result should be ignored', function(){
      var actionValue;
      command
        .option('--bool', 'description', function(value){
          actionValue = value;
        });

      command.parse(['--bool']);

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

      command.parse(['--no-bool']);
      assert(command.values.bool === false);
    });

    it('should throw an exception for non-inverted option', function(){
      command
        .option('--no-bool');

      assert.throws(function(){
        command.parse(['--bool']);
      });
    });

    it('action should receive false', function(){
      var actionValue;
      command
        .option('--no-bool', 'description', function(value){
          actionValue = value;
        });

      command.parse(['--no-bool']);

      assert(actionValue === false);
    });

    it('action result should be ignored', function(){
      var actionValue;
      command
        .option('--no-bool', 'description', function(value){
          actionValue = value;
        });

      command.parse(['--no-bool']);

      assert(command.values.bool === false);
    });
  });
});
