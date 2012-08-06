module.exports = function(flow){
  var at = require('./index');

  function test(file, cfg){
    var t = new Date;
    var my = at.translate2(file.ast, cfg);
    var my_time = new Date - t;

    var t = new Date;
    var ug = at.translate(file.ast, cfg);
    var ug_time = new Date - t;

    console.log(ug == my);

    if (ug != my)
    {
      for (var j = 0; j < ug.length; j++)
        if (ug[j] != my[j])
        {
          var start = Math.max(0, j - 40);
          console.log('my: ', my.slice(start, start + 200));
          console.log('ug: ', ug.slice(start, start + 200));
          break;
        }
    }

    return [my_time, ug_time];
  }

  var time_ = 0;

  var my_time = 0;
  var ug_time = 0;
  var my_b_time = 0;
  var ug_b_time = 0;
  //var tmp = [];

  for (var i = 0, file, t; file = flow.files.queue[i]; i++)
    if (file.type == 'script')
    {
      //tmp.push(file.ast);
      console.log(file.relpath);

      var t = new Date;
      at.walk(file.ast, function(){ });
      time_ += new Date - t;

      t = test(file, {ascii_only:0});
      my_time += t[0];
      ug_time += t[1];

      t = test(file, {ascii_only:0,beautify:true});
      my_b_time += t[0];
      ug_b_time += t[1];
    }

  //require('fs').writeFileSync('ast.json', 'var ast = [\n' + tmp.map(JSON.stringify).join(',\n') + '\n]', 'utf-8');

  console.log('\n\n=================\n');
  console.log('base walk time:', time_);
  console.log('my time:', my_time);
  console.log('ug time:', ug_time);
  console.log('my beautify time:', my_b_time);
  console.log('ug beautify time:', ug_b_time);
}
