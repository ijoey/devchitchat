var path = require('path');
var ejs = require('ejs');
var fs = require('fs');
var mime = require('mime');
var url = require('url');
module.exports = (function(){
	var self = {};	
	var _themeRoot = __dirname + "/themes/default/";
	self.__defineGetter__("themeRoot", function(){
		return _themeRoot;
	});
	self.__defineSetter__("themeRoot", function(v){
		_themeRoot = v;
	});	
	var _viewsRoot = _themeRoot + "views/";
	self.__defineGetter__("viewsRoot", function(){
		return _viewsRoot;
	});
	self.__defineSetter__("viewsRoot", function(v){
		_viewsRoot = v;
	});	
	var _layoutRoot = _viewsRoot + "layouts/";
	self.__defineGetter__("layoutRoot", function(){
		return _layoutRoot;
	});
	self.__defineSetter__("layoutRoot", function(v){
		_layoutRoot = v;
	});

	var _defaultExt = ".html";
	self.__defineGetter__("defaultExt", function(){
		return _defaultExt;
	});
	self.__defineSetter__("defaultExt", function(v){
		_defaultExt = v;
	});	

	self.execute = function(result){
		var output = null;
		var useLayout = true;
		var parsed = url.parse(result.request.url, true, true);
		var ext = path.extname(parsed.pathname);
		if(ext.length === 0) ext = this.defaultExt;
		if(ext === ".phtml"){
			ext = ".html";
			useLayout = false;
		}
		var filePath = this.viewsRoot + result.view + ext;
		for(prop in result.resource.header){
			result.response.setHeader(prop, result.resource.header[prop]);
		}
		
		if(!result.resource.header["Content-Type"]) result.response.setHeader("Content-Type", mime.lookup(ext));
		if(result.resource.status.code){
			result.response.statusCode = result.resource.status.code;
		}
		fs.exists(filePath, function(exists){
			if(exists){
				fs.readFile(filePath, {encoding: "utf-8"}
					, function(err, data){
						if(err) throw err;
						output = ejs.render(data, result);
						output = output.split(/\n/).join('');
						if(!useLayout){
							result.output = output;
							if(!result.resource.status.code) result.response.statusCode = 200;
							output = ejs.render(data, result);
							result.response.setHeader('Content-Length', Buffer.byteLength(output));
							result.response.send(output);
						}else{
							var layoutPath = self.layoutRoot + result.resource.layout + ext;
							fs.readFile(layoutPath, {encoding: "utf-8"}
								, function(err, data){
									if(err) throw err;
									result.output = output;
									output = ejs.render(data, result);
									output = output.split(/\n/);
									output.forEach(function(s){
										s = s.replace(/^\t+/, '');
									});
									output = output.join('');
									if(!result.resource.status.code) result.response.statusCode = 200;
									result.response.setHeader('Content-Length', Buffer.byteLength(output));
									result.response.send(output);				
								}
							);
						}
					}
				);
			}else{
				if(!result.resource.header["Content-Type"]) result.response.setHeader("Content-Type", mime.lookup(ext));
				if(ext === ".json"){
					if(!result.resource.status.code) result.response.statusCode = 200;
					output = JSON.stringify(result.model);
					result.response.setHeader('Content-Length', Buffer.byteLength(output));
					result.response.send(output);
				}else{
					result.next(404);
				}
			}
		});
	};
	return self;
})();