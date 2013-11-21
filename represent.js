var Path = require('path');
var fs = require('fs');
var mime = require('mime');
var Url = require('url');
var Mimeparse = require('./mimeparse.js');
var contentTypes = {};
var conteTypesFolder = __dirname + "/contentTypes";
fs.readdirSync(conteTypesFolder).forEach(function(file) {
	var contentType = require(conteTypesFolder + "/" + file);
	contentTypes[contentType.key] = contentType;
});

module.exports = (function(){
	var self = {};	
	var themeRoot = __dirname + "/themes/default/";
	Object.defineProperty(self, 'themeRoot', {
		get: function(){ return themeRoot;}
		, set: function(v){
			themeRoot = v;
		}
		, enumerable: true
	});
	
	var viewsRoot = themeRoot + "views/";
	Object.defineProperty(self, 'viewsRoot', {
		get: function(){ return viewsRoot;}
		, set: function(v){
			viewsRoot = v;
		}
		, enumerable: true
	});

	var layoutRoot = viewsRoot + "layouts/";
	Object.defineProperty(self, 'layoutRoot', {
		get: function(){ return layoutRoot;}
		, set: function(v){
			layoutRoot = v;
		}
		, enumerable: true
	});

	var defaultExt = ".html";
	Object.defineProperty(self, 'defaultExt', {
		get: function(){ return defaultExt;}
		, set: function(v){
			defaultExt = v;
		}
		, enumerable: true
	});
	
	function fromTheAcceptHeader(method, headers){
		var key = null;
		if(['GET','HEAD'].indexOf(method) > -1) key = 'accept';
		else key = 'content-type';
		var ext = null;
		if(headers[key]){
			var bestMatch = Mimeparse.bestMatch(['text/html', 'application/json', 'application/xml', '*/*'], headers[key]);
			ext = mime.extension(bestMatch);
		}
		if(ext !== null && ext !== undefined) return '.' + ext;
		return null;
	}
	function fromUrl(url){
		var parsed = Url.parse(url, true, true);
		return Path.extname(parsed.pathname);
	}
	function extensionViaContentNegotation(request){
		var urlExt = fromUrl(request.url);
		if(urlExt.length > 1) return urlExt;
		var ext = fromTheAcceptHeader(request.method, request.headers);
		return ext;
	}
	
	self.execute = function(result){
		var output = null;
		var ext = extensionViaContentNegotation(result.request);
		if(ext === null) ext = this.defaultExt;
		ext = ext === ".phtml" ? ".html" : ext;
		var filePath = this.viewsRoot + result.view + ext;
		for(prop in result.resource.header) result.response.setHeader(prop, result.resource.header[prop]);
		var contentTypeKey = mime.lookup(ext);
		var contentType = contentTypes[contentTypeKey];
		if(!result.resource.header["Content-Type"]) result.response.setHeader("Content-Type", contentTypeKey);
		if(result.resource.status.code) result.response.statusCode = result.resource.status.code;
		else result.response.statusCode = 200;
		fs.exists(filePath, function(exists){
			if(!contentType) return result.response.send(406);
			contentType.execute(filePath, self, result, function(output){
				result.response.setHeader('Content-Length', Buffer.byteLength(output));
				result.response.send(output);
			});
		});
	};
	return self;
})();