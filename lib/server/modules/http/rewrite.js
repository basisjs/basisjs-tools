var chalk = require('chalk');
var httpProxy = require('http-proxy');
var url = require('url');
var logMsg = require('../utils').logMsg;
var logWarn = require('../utils').logWarn;

// avoid UNABLE_TO_VERIFY_LEAF_SIGNATURE error with invalid SSL certificates on the server
// http://stackoverflow.com/questions/20082893/unable-to-verify-leaf-signature
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

function getPathRulesKey(rules, referrer){
  return Object.keys(rules)
    .filter(function(path){
      return referrer.indexOf(path) === 0;
    })
    .sort(function(a, b){
      return a.length - b.length;
    })[0] || '*';
}

function createRewriteMiddleware(rulesMap){
  return function rewriteMiddleware(req, res, next){
    function getRulesPath(){
      return rulesKey != '*' ? ' <' + chalk.green(rulesKey) + '>' : '';
    }

    var loc = url.parse('//' + req.headers.host + req.url, true, true);
    var referrer = req.headers.referer ? url.parse(req.headers.referer, true, true).pathname : '';
    var rulesKey = getPathRulesKey(rulesMap, referrer);
    var rules = rulesMap[rulesKey];

    for (var i = 0, rule; rule = rules[i]; i++)
    {
      var pathmatch = loc[rule.part].match(rule.re);
      // console.log(rule.part, loc);
      // console.log('match:', pathmatch, loc[rule.part], rule.re);
      // console.log(rule.url);
      if (pathmatch)
      {
        var ruleParts = rule.url.trim().split(/\s+/);
        var ruleUrl = ruleParts.shift();
        var args = ruleParts.join(' ').toUpperCase().replace(/^\[|\]$/g, '').split(/\s*\,\s*/);
        var location = url.parse(ruleUrl.replace(/\$(\d+)/g, function(m, n){
          return n in pathmatch ? pathmatch[n] || '' : m;
        }));

        // if no host in new url, copy from original
        if (location.host == null)
        {
          location.host = loc.host;
          location.hostname = loc.hostname;
          location.port = loc.port;
        }

        var responseCode;
        for (var i = 0; i < args.length; i++)
          if (args[i].match(/^R(\d{3}|)$/))
            responseCode = RegExp.$1 || 307;

        if (args.indexOf('QSA') !== -1 && loc.search && rule.part != 'path' && rule.part != 'href')
        {
          var searchStr = location.search ? loc.search.replace(/^\?/, '&') : loc.search;
          ['href', 'path', 'search'].forEach(function(part){
            location[part] += searchStr;
          });
        }

        if (loc.host == location.host && !responseCode)
        {
          // internal url changes
          logMsg('rewrite', getRulesPath() + ' ' + loc.href + ' -> ' + location.href);

          if (!req.rewritten)
            req.rewritten = [];

          req.rewritten.push({
            host: loc.host,
            url: loc.url
          });

          loc = location;
        }
        else
        {
          if (args.indexOf('P') !== -1)
          {
            if (!rule.proxy)
            {
              // lazy proxy creation for rule
              rule.proxy = new httpProxy.HttpProxy({
                changeOrigin: true,
                target: {
                  host: location.hostname,
                  port: location.port || (location.protocol == 'https:' ? 443 : 80),
                  https: location.protocol == 'https:'
                },
                enable: {
                  xforward: false
                }
              });

              rule.proxy.on('proxyError', function(err){
                logWarn('proxy', err);

                try {
                  res.writeHead(500, { 'Content-Type': 'text/plain' });
                  if (req.method !== 'HEAD')
                  {
                    var errMsg = JSON.stringify(err);
                    res.end('An error has occurred: ' + (errMsg != '{}' ? errMsg : err && err.message || err));
                  }
                } catch(e) {}
              });
            }

            logMsg('rewrite', 'proxy request' + getRulesPath() + ':\n       \u250C\u2500 ' + loc.href + '\n       \u2514\u2192 ' + location.href);

            // proxy request
            req.url = location.path;
            rule.proxy.proxyRequest(req, res);
          }
          else
          {
            if (!responseCode)
              responseCode = 307;

            if (responseCode == 301 || responseCode == 302 || responseCode == 303 || responseCode == 307 || responseCode == 308)
            {
              logMsg('rewrite', getRulesPath() + ' ' + loc.href + ' redirect to ' + location.href + ' ' + chalk.green(responseCode));
              res.writeHead(responseCode, {
                Location: location.href
              });
              res.end();
            }
            else
            {
              logMsg('rewrite', getRulesPath() + ' ' + loc.href + ' ' + responseCode);
              res.writeHead(responseCode);
              res.end('Response code ' + responseCode);
            }
          }

          return;
        }
      }
    }

    req.headers.host = loc.host;
    req.url = loc.path;

    next();
  };
}

function processRule(store, key, value) {
  var part = 'pathname';
  var rx = key.replace(/^(host|hostname|port|path|pathname|href):/, function(m, name){
    part = name;
    return '';
  });
  store.push({
    msg: '/' + key + '/' + ' -> ' + value,
    re: new RegExp(rx),
    url: value,
    part: part,
    proxy: null
  });
}

module.exports = function(config){
  var rules = {
    '*': []
  };

  if (!config)
    return;

  for (var key in config)
  {
    var value = config[key];
    if (typeof value != 'string')
    {
      if (!rules[key])
        rules[key] = [];

      for (var skey in value)
        processRule(rules[key], skey, value[skey]);
    }
    else
    {
      processRule(rules['*'], key, value);
    }
  }

  return {
    middleware: createRewriteMiddleware(rules),
    banner: function(){
      console.log('Rewrite rules:');
      Object.keys(rules).sort().forEach(function(pathMask){
        var pathRules = rules[pathMask];

        if (!pathRules.length)
          return;

        console.log('  ' + chalk.cyan(pathMask));

        pathRules.forEach(function(rule){
          console.log('    ' + chalk.green(rule.re.toString()) + ' → ' + chalk.green(rule.url));
        });

        console.log('');
      });
    }
  };
};
