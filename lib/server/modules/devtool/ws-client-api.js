/* eslint-env browser */
/* global api, sendToServer, socket */

var document = global.document;
var documentStyleOverflow;
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
  var tmp = document.createElement('div');
  tmp.innerHTML =
    '<div style="position:fixed;top:0;left:0;bottom:0;right:0;z-index:100000000;background:rgba(255,255,255,.9);text-align:center;line-height:1.5;font-family:Tahoma,Verdana,Arial,sans-serif">' +
      '<div style="font-size: 33vmax">#</div>' +
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

// socket messages
socket
  .on('devtool:identify', startIdentify)
  .on('devtool:stop identify', stopIdentify)
  .on('disconnect', function(){
    stopIdentify();
    clearInterval(sendInfoTimer);
  });

// extend api
api.initDevtool = function(devtool){
  clearInterval(sendInfoTimer);
  clientInfo = getSelfInfo();
  sendToServer('devtool:client connect', clientInfo, function(data){
    if ('clientId' in data)
      clientId = sessionStorage['basisjs-tools-clientId'] = data.clientId;

    socket.on('devtool:get ui', devtool.getInspectorUI);

    sendInfoTimer = setInterval(sendInfo, 150);
  });
};
