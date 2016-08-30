/* eslint-env browser */
/* global Token, api, sendToServer, socket */

var document = global.document;
var documentStyleOverflow;
var sessionStorage = global.sessionStorage || {};
var clientId = sessionStorage['basisjs-tools-clientId'];
var sessionId = genUID();
var overlay = createOverlay();
var features = [];
var clientInfo = getSelfInfo();
var sendInfoTimer;

function genUID(len){
  function base36(val){
    return Math.round(val).toString(36);
  }

  // uid should starts with alpha
  var result = base36(10 + 25 * Math.random());

  if (!len)
    len = 16;

  while (result.length < len)
    result += base36(new Date * Math.random());

  return result.substr(0, len);
}

function getSelfInfo(){
  return {
    clientId: clientId,
    sessionId: sessionId,
    title: document.title,
    location: String(location),
    features: features
  };
}

function sendInfo(){
  var newClientInfo = getSelfInfo();
  if (clientInfo.title != newClientInfo.title ||
      clientInfo.location != newClientInfo.location ||
      String(clientInfo.features) != String(newClientInfo.features)) {
    clientInfo = newClientInfo;
    sendToServer('devtool:client info', getSelfInfo());
  }
}

function createOverlay(){
  var tmp = document.createElement('div');
  tmp.innerHTML =
    '<div style="position:fixed;top:0;left:0;bottom:0;right:0;z-index:100000000;background:rgba(255,255,255,.9);text-align:center;line-height:1.5;font-family:Tahoma,Verdana,Arial,sans-serif">' +
      '<div style="font-size:100px;font-size:33vh">#</div>' +
      '<button style="font-size:18px;line-height:1;padding:12px 24px;background:#3BAFDA;color:white;border:none;border-radius:3px;cursor:pointer;">Start inspect</button>' +
    '</div>';
  return tmp.firstChild;
}

function startIdentify(num, callback){
  overlay.firstChild.innerHTML = num;
  overlay.lastChild.onclick = callback;
  documentStyleOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  document.body.appendChild(overlay);
}
function stopIdentify(){
  if (overlay.parentNode !== document.body)
    return;

  document.body.style.overflow = documentStyleOverflow;
  document.body.removeChild(overlay);
}

function startSyncClient(){
  clearInterval(sendInfoTimer);
  clientInfo = getSelfInfo();
  sendToServer('devtool:client connect', clientInfo, function(data){
    if ('clientId' in data)
      clientId = sessionStorage['basisjs-tools-clientId'] = data.clientId;

    api.remoteInspectors.set(data.inspectors || 0);

    sendInfoTimer = setInterval(sendInfo, 150);
  });
}

// socket messages
socket
  .on('devtool:identify', startIdentify)
  .on('devtool:stop identify', stopIdentify)
  .on('devtool:inspector count changed', function(count){
    api.remoteInspectors.set(count);
  })
  .on('disconnect', function(){
    api.remoteInspectors.set(0);
    clearInterval(sendInfoTimer);
    stopIdentify();
  });

// extend api
api.remoteInspectors = new Token(0);
api.getRemoteUrl = function(){
  return location.protocol + '//' + location.host + '/basisjs-tools/devtool/';
};
api.initRemoteDevtoolAPI = function(devtool){
  var subscribers = [];

  socket
    .on('connect', startSyncClient)
    .on('devtool:get ui', devtool.getInspectorUI)
    .on('devtool:to session', function(){
      for (var i = 0; i < subscribers.length; i++)
        subscribers[i].apply(null, arguments);
    });

  if (socket.connected)
    startSyncClient();

  return {
    getRemoteUrl: function(){
      return clientId
        ? api.getRemoteUrl() + '#' + clientId
        : '';
    },
    setFeatures: function(list){
      features = Array.prototype.slice.call(list || []);
      sendInfo();
    },
    send: function(){
      socket.emit.apply(socket, ['devtool:client data'].concat(
        Array.prototype.slice.call(arguments)
      ));
    },
    subscribe: function(fn){
      subscribers.push(fn);
    }
  };
};
