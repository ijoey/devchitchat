var Bus = require('../boundaries/bus');
var shouldStop = process.argv.length > 2 ? process.argv[2] === 'stop' : false;
var stoppingPort = 8124;
if(shouldStop){
	var client = new Bus.Client();
	function Stop(message){
		this.body = message;
		this.header = {
			tried: 0
			, endpoint: {port: stoppingPort, host:'localhost'}
			, retries: 3
			, name: 'Stop'
			, token: null
			, id: (new Date()).getTime()
		};
		this.type = 'command';
	}
	var stopWeb = new Stop({message: "Stop the web server"});
	stopWeb.header.endpoint.port = stoppingPort;
	client.send(stopWeb);
	setTimeout(function(){
		process.exit(0);
	}, 1000);
}else{
	var stopBus = new Bus.Publisher(stoppingPort);
	var web = require('./index');
	var os=require('os');
	var ifaces = os.networkInterfaces();
	var addresses = [];
	var CookieParser = require('cookie-parser');
	var CookieSession = require('cookie-session');
	for(var key in ifaces){
		var iface = ifaces[key];
		if(iface.family !== 'IPv4'){
			continue;
		}
		if(iface.internal){
			continue;
		}
		var address = iface.reduce(function(previous, current, index, ary){
			return current.address;
		});
		addresses.push(address);
	}
	var localhost = addresses.reduce(function(previous, current, index, ary){
		return current === null ? previous : current;
	});
	stopBus.start();
	stopBus.iHandle('Stop', {
		handle: function(command){
			console.log('received stop command', command);
			process.exit(0);
		}
	});
	
	var server = web.http.listen(web.config.port, function(){
		console.log('HttpServer listening on http://%s:%s', localhost, web.config.port);
	});
	var chatServer = require('./chat')({
		server: server,
		config: web.config,
		cookieParser: CookieParser,
		cookieSession: CookieSession,
		bus: web.bus,
		Persistence: web.persistence
	});
}