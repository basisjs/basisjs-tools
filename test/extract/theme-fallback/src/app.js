require('basis.template').define({
  base: resource('./base.tmpl'),
  baseOverrideApp: resource('./base-override-app.tmpl'),
  baseOverrideTouch: resource('./base-override-touch.tmpl'),
  baseOverrideAppTouch: resource('./base-override-app-touch.tmpl')
});

require('basis.template').theme('app').define({
  baseOverrideApp: resource('./app_base-override-app.tmpl'),
  baseOverrideAppTouch: resource('./app_base-override-app-touch.tmpl'),

  app: resource('./app.tmpl'),
  appOverrideTouch: resource('./app-override-touch.tmpl')
});

require('basis.template').theme('touch').fallback('app').define({
  baseOverrideTouch: resource('./touch_base-override-touch.tmpl'),
  appOverrideTouch: resource('./touch_app-override-touch.tmpl'),
  baseOverrideAppTouch: resource('./touch_base-override-app-touch.tmpl'),

  touch: resource('./touch.tmpl')
});
