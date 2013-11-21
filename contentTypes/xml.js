function toXml(obj){
	var xml = '';
	if(Array.isArray(obj)){
		xml += '<items>';
		for(var key in obj) xml += '<item>' + toXml(obj[key]) + '</item>';
		return xml + '</items>';
	}
	for(var key in obj){
		if(obj[key] === null) continue;
		if(typeof obj[key] === 'function') continue;
		if(typeof obj[key] === 'string'){
			xml += '<' + key + '>' + encodeURIComponent(obj[key]) + '</' + key + '>\n';				
		}else{
			xml += '<' + key + '>' + toXml(obj[key]) + '</' + key + '>\n';
		}
	}
	return xml;
}

module.exports = (function xml(){
	return {
		key: "application/xml"
		, execute: function(filePath, represent, result, callback){
			var output = null;
			if(typeof result.model === 'string') output = '<value>' + result.model + '</value>';
			if(output === null) output = toXml(result.model);
			output = '<?xml version="1.0" encoding="UTF-8"?>\n<root>' + output + '</root>';
			callback(output);
		}
	};
})();