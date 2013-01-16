exports.process = function(content){
	return content.replace(/(;;;|\/\*\*\s*@cut.*?\*\/).*([\r\n]|$)/g, '');
}