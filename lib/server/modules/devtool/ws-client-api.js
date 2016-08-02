/* eslint-env browser */
/* global api, sendToServer, socket */

var document = global.document;
var sessionStorage = global.sessionStorage || {};
var clientId = sessionStorage['basisjs-tools-clientId'];
var overlay = createOverlay();
var clientInfo;
var sendInfoTimer;

function getSelfInfo(){
  return {
    clientId: clientId,
    title: document.title,
    location: String(location)
  };
}
function sendInfo(){
  var newClientInfo = getSelfInfo();
  if (clientInfo.title != newClientInfo.title ||
      clientInfo.location != newClientInfo.location) {
    clientInfo = newClientInfo;
    sendToServer('devtool:client info', getSelfInfo());
  }
}

function createOverlay(){
  var overlay = document.createElement('div');
  overlay.style = 'display:none;position:fixed;top:0;left:0;bottom:0;right:0;z-index:100000000;background:rgba(255,255,255,.9);text-align:center;line-height:1.5;font-family:Tahoma,Verdana,Arial,sans-serif';
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  overlay.innerHTML =
    '<div style="font-size: 33vmax">#</div>' +
    '<button style="font-size:18px;line-height:1;padding:12px 24px;background:#3BAFDA;color:white;border:none;border-radius:3px;cursor:pointer;">Start inspect</button>';
  overlay.lastChild.onclick = function(){
    socket.emit('devtool:select me', clientId);
  };
  return overlay;
}

// connection events
socket.on('disconnect', function(){
  clearInterval(sendInfoTimer);
});

function startIdentify(num){
  overlay.style.display = 'block';
  overlay.firstChild.innerHTML = num;
}

function stopIdentify(){
  overlay.style.display = 'none';
}

socket.on('devtool:identify', startIdentify);
socket.on('devtool:stop identify', stopIdentify);

api.initDevtool = function(){
  clearInterval(sendInfoTimer);
  clientInfo = getSelfInfo();
  sendToServer('devtool:client connect', clientInfo, function(data){
    if ('clientId' in data)
      clientId = sessionStorage['basisjs-tools-clientId'] = data.clientId;

    if (data.mode === 'identify')
      startIdentify(data.num);
    else
      stopIdentify();

    sendInfoTimer = setInterval(sendInfo, 150);
  });
};
