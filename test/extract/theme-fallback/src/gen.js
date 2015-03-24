var fs = require('fs');

[
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
].forEach(function(fn){
  fs.writeFileSync(name + '.tmpl',
    '<b:style src="' + name + '.css"/>\n<!-- ' + name + ' -->'
  );
  fs.writeFileSync(name + '.css',
    '.' + fn.substring(2, fn.length - 5) + ' {}'
  );
});
