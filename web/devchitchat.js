var web = require('./index');
var os = require('os');
var ifaces = os.networkInterfaces();
var addresses = [];
var cookieParser = require('cookie-parser');
var cookieSession = require('cookie-session');
for(var key in ifaces){
	var iface = ifaces[key];
	var address = iface.filter(function(element, index, arry){
		return !element.internal && element.family === 'IPv4';
	});
	if(address.length === 0){
		continue;
	}
	address.forEach(function(a){
		addresses.push(a);
	});
}
var localhost = addresses.map(function(current, index, ary){
	return current.address;
}).reduce(function(previous, current, index, ary){
	return current;
});
var server = web.http.listen(web.config.port, function(){
	console.log('HttpServer listening on http://%s:%s', localhost, web.config.port);
});
var chatServer = require('./chat')({
	server: server,
	config: web.config,
	cookieParser: cookieParser,
	cookieSession: cookieSession,
	bus: web.bus,
	Persistence: web.persistence
});
