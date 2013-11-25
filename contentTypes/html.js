var Path = require('path');
var Fs = require('fs');
var Ejs = require('ejs');
function readFromFile(filePath, result, callback){
	Fs.readFile(filePath, {encoding: "utf-8"}
		, function(err, data){
			if(err) throw err;
			var output = Ejs.render(data, result);
			output = output.split(/\n/);
			output.forEach(function(s){ s = s.replace(/^\t+/, '')});
			output = output.join('');
			callback(output);
		});
}
module.exports = (function html(){
	return {
		key: "text/html"
		, execute: function(exists, filePath, represent, result, callback){
			if(!exists){
				result.response.statusCode = 404;
				return callback("Not found");
			}
			readFromFile(filePath, result, function(output){
				if(result.request.url.indexOf('.phtml') > -1) return callback(output);
				result.output = output;
				var layout = represent.layoutRoot + result.resource.layout + ".html";
				Fs.exists(layout, function(exists){
					if(!exists) return callback(output);
					readFromFile(layout, result, function(output){
						callback(output);					
					});
				});
			});
		}
	};
})();

