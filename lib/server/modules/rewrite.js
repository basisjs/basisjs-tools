var logMsg = require('./utils').logMsg;
var logWarn = require('./utils').logWarn;
var httpProxy = require('http-proxy');
var url = require('url');

// avoid UNABLE_TO_VERIFY_LEAF_SIGNATURE error with invalid SSL certificates on the server
// http://stackoverflow.com/questions/20082893/unable-to-verify-leaf-signature
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

function createReqriteFunction(rules){
  return function(loc, req, res){
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
          logMsg('rewrite', loc.href + ' -> ' + location.href);
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

            logMsg('rewrite', 'proxy request:\n       \u250C\u2500 ' + loc.href + '\n       \u2514\u2192 ' + location.href);

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
              logMsg('rewrite', loc.href + ' redirect to ' + location.href + ' ' + chalk.green(responseCode));
              res.writeHead(responseCode, {
                Location: location.href
              });
              res.end();
            }
            else
            {
              logMsg('rewrite', loc.href + ' ' + responseCode);
              res.writeHead(responseCode);
              res.end('Response code ' + responseCode);
            }
          }

          return false;
        }
      }
    }
    return loc;
  };
}

module.exports = {
  create: function(rules){
    var rewriteRules = [];
    var result;

    for (var key in rules)
    {
      var part = 'pathname';
      var rx = key.replace(/^(host|hostname|port|path|pathname|href):/, function(m, name){
        part = name;
        return '';
      });
      rewriteRules.push({
        msg: '/' + key + '/' + ' -> ' + rules[key],
        re: new RegExp(rx),
        url: rules[key],
        part: part,
        proxy: null
      });
    }

    result = createReqriteFunction(rewriteRules);
    result.rules = rewriteRules;

    return result;
  }
};
