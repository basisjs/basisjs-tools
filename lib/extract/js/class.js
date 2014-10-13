var at = require('../../ast').js;

//
// classes
//
module.exports = {
  runner: function(flow){
    var fconsole = flow.console;

    function createClass(context, args, t){
      var superClass = args[0];
      var prototype = ['object', []];
      var className = 'UnknownClassName';

      if (superClass && superClass.ref_)
        superClass = superClass.ref_;

      if (superClass && superClass.obj)
      {
        var F = function(){};
        F.prototype = superClass.obj.prototype.obj;
        prototype.obj = new F;
      }
      else
        prototype.obj = {};

      for (var i = 1; i < args.length; i++)
      {
        var extArg = args[i];
        var source;
        if (extArg)
        {
          if (extArg[0] == 'object')
            source = extArg.obj;
          else
          {
            //console.log(extArg);
            //process.exit();
          }

        }
        if (source)
        {
          for (var key in source)
          {
            if (key == 'className')
              className = source.className;
            else
            {
              var extend = prototype.obj[key] && prototype.obj[key].obj && prototype.obj[key].obj.__extend__;
              //console.log(key, !!prototype.obj[key], !!extend);
              prototype.obj[key] = extend && extend.run
                ? extend.run.call(null, extend, prototype.obj[key], [context.scope.resolve(source[key]) || source[key]], key, context)
                : source[key];
            }
          }
        }
      }

      fconsole.log('[basis.Class.create]');// at.translate(t);

      var token = ['function', null, []];
      token.src = t;
      token.obj = {
        className: className,
        isClass: true,
        /*__extend__: at.createRunner(function(token, this_, args, key, context){
          //console.log('~~~', args[0].obj.isClass, args[0] === CLASS_SELF);
          if (args[0].obj.isClass || args[0] === CLASS_SELF)
            return args[0];
          else
          {
            //console.log('[~~~] Create class via auto-extend: ', key);
            return createClass(context, [this_, args[0]], args[0]);
          }
        }),*/
        prototype: prototype,
        subclass: at.createRunner(function(token_, this_, args){
          token_.obj = createClass(this, [token_[1][1]].concat(args), token_).obj;
        })
      };

      token.ref_ = t;
      flow.js.classes.push(token);

      return token;
    }

    return function classRunner(token, this_, args){
      var cls = createClass(this, args, token);
      token.obj = cls.obj;
      // cls.ref_ = token;
    };
  }
};
