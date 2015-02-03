var net = require('net');
var fs = require('fs');
var Datastore = require('nedb');

function didAdd(change){
	
}
function didDelete(change){
	
}
function queueChanged(changes){
	changes.forEach(function(change){
		if(change.type === 'add' && !isNaN(change.name)){
			didAdd.apply(this, [change]);
		}
		
		if(change.type === 'delete' && !isNaN(change.name)){
			didDelete.apply(this, [change]);
		}
	}.bind(this));
}
function Queue(config){
	this.config = config;
}
Queue.prototype = Object.create(Array.prototype);

function Response(code){
	this.code = code;
	this.status = code === 200 ? 'ok' : 'not ok';
}
function IncomingMessageHandler(server, message){
	if(message.type === 'command') return new CommandHandler(server.handlers, message);
	else if(message.type === 'event') return new EventHandler(server.subscribers, message);
	else if(message.type === 'subscription') return new SubscriptionHandler(server, message);
	else if(message.type === 'request') return new RequestHandler(server, message);
}
function SubscriptionHandler(server, subscription){
	this.server = server;
	this.subscription = subscription;
}
SubscriptionHandler.prototype = {
	execute: function(c, callback){
		var name = this.subscription.header.name;
		var subscriber = this.subscription.subscriber;
		if(!this.server.subscribers[name]) this.server.subscribers[name] = [];
		var found = this.server.subscribers[name].filter(function(sub){
			return sub.port === subscriber.port && sub.host === subscriber.host;
		});
		if(found && found.length > 0) return callback(null, new Response(200));
		this.server.subscribers[name].push(subscriber);
		callback(null, new Response(200));
	}
};
function CommandHandler(handlers, command){
	this.handlers = handlers;
	this.command = command;
}
CommandHandler.prototype = {
	execute: function(c, callback){
		var handler = this.handlers[this.command.header.name];
		if(!handler) return;
		if(typeof handler === 'function'){
			return handler(this.command, callback);
		}
		handler.handle(this.command, callback);
	}
};
function RequestHandler(server, message){
	this.server = server;
	this.message = message;
	this.commandHandler = new CommandHandler(server.responders, message);
}
RequestHandler.prototype = {
	execute: function(c, callback){
		this.commandHandler.execute(c, function(err, response){
			callback(err, response);
		});
	}
};

function EventHandler(subscribers, event){
	this.subscribers = subscribers;
	this.event = event;
}
EventHandler.prototype = {
	execute: function(c, callback){
		for(var i = 0; i < this.subscribers[this.event.header.name].length; i++){
			var sub = this.subscribers[this.event.header.name][i];
			if(typeof sub === 'function'){
				sub(this.event);
			}
			sub.update(this.event);
		}
		callback(null, new Response(200));
	}
};
function Subscription(name, publisher, subscriber){
	this.id = (new Date()).getTime();
	this.header = {endpoint: publisher, name: name};
	this.subscriber = subscriber;
	this.type = 'subscription';
}
function Publisher(port, host){
	this.host = host || 'localhost';
	this.server = new Server(port, this);
	var self = this;
	this.events = new Queue({name: 'events'});
	this.subscribers = {};
	this.eventInterval = setInterval(function(){
		var event = null;
		if(self.events.length === 0) return;
		event = self.events.shift();
		if(!self.subscribers[event.header.name]){
			return;
		}
		for(var i = 0; i < self.subscribers[event.header.name].length; i++){
			event.header.endpoint = self.subscribers[event.header.name][i];
			sendMessageOnce(event);
		}
	}, 100);
	this.folder = __dirname + '/subscribers';
	this.subscribersFilePattern = this.folder + '/subscribers_for_{port}.json';
	
	if(!fs.existsSync(this.folder)){
		fs.mkdirSync(this.folder);
	}
	
	Object.defineProperty(this, 'handlers', {
		get: function(){ return self.server.handlers;}
		, enumerable: true
	});
	Object.defineProperty(this, 'responders', {
		get: function(){ return self.server.responders;}
		, enumerable: true
	});
	Object.defineProperty(this, 'port', {
		get: function(){ return self.server.port;}
		, enumerable: true
	});
}
Publisher.prototype = {
	publish: function(event){
		this.events.push(event);
	}
	, iHandle: function(name, handler){
		this.server.iHandle(name, handler);
	}
	, iRespondTo: function(name, responder){
		this.server.iRespondTo(name, responder);
	}
	, start: function(){
		var fileName = this.subscribersFilePattern.replace(/\{port\}/, this.port);
		if(fs.existsSync(fileName)) this.subscribers = JSON.parse(fs.readFileSync(fileName));
		this.server.start();
	}
	, stop: function(){
		this.server.stop();
	}
	, willShutDown: function(){
		fs.writeFileSync(this.subscribersFilePattern.replace(/\{port\}/, this.port), JSON.stringify(this.subscribers), 'utf-8');
	}
};

function Subscriber(port, host){
	this.subscriptions = {};
	this.subscribers = {};
	this.host = host || 'localhost';
	this.server = new Server(port, this);
	var self = this;
	this.subscriptionsInterval = setInterval(function(){
		for(var key in self.subscriptions){
			var subscription = null;
			if(self.subscriptions[key].length === 0){
				continue;
			}
			subscription = self.subscriptions[key].shift();
			sendMessageRecursively(subscription, function(){
				return self.subscriptions[key].shift();
			});
		}
	}, 100);
}
Subscriber.prototype = {
	iSubscribeTo: function(name, publisher, subscriber){
		if(!this.subscriptions[name]) this.subscriptions[name] = [];
		if(!this.subscribers[name]) this.subscribers[name] = [];
		this.subscribers[name].push(subscriber);
		this.subscriptions[name].push(new Subscription(name, publisher, {port: this.server.port, host: this.server.host}));
	}
	, start: function(){
		this.server.start();
	}
	, stop: function(){
		this.server.stop();
	}
};

function Client(){
	this.commands = new Queue({name: 'commands'});
	this.commandInterval = setInterval(function(){
		var command = null;
		if(this.commands.length === 0) return;
		command = this.commands.shift();
		sendMessageOnce(command);
	}.bind(this), 100);
}
Client.prototype = {
	send: function(command){
		this.commands.push(command);
	}
	, request: function(message, callback){
		sendMessageOnce(message, callback);
	}
};

var runningServerCount = 0;
function Server(port, delegate){
	this.port = port || 8124;
	this.host = delegate && delegate.host ? delegate.host : 'localhost';
	this.handlers = {};
	this.responders = {};
	this.server = null;
	this.delegate = delegate;
	this.listeners = {};
}
Server.prototype = {
	iHandle: function(name, handler){
		if(this.handlers[name]) throw new Error(name + ' is already handled');
		this.handlers[name] = handler;
	}
	, iRespondTo: function(name, responder){
		if(this.responders[name]) throw new Error(name + ' already has a responder');
		this.responders[name] = responder;
	}
	, send: function(command){
		this.commands.push(command);
	}
	, stop: function(){
		runningServerCount--;
		if(this.delegate.willShutDown) this.delegate.willShutDown();
		clearInterval(this.commandInterval);
		clearInterval(this.eventInterval);
	}
	, start: function(){
		if(this.server !== null) return this.server;
		runningServerCount++;
		var self = this;
		this.server = net.createServer(function(c){
			c.setEncoding('utf8');
			c.on('data', function(data){
				var message = null;
				try{
					message = JSON.parse(data);					
					(new IncomingMessageHandler(self.delegate, message)).execute(c, function(err, response){
						c.write(JSON.stringify(response));
					});
				}catch(exception){
					console.trace('on start', exception, data);
				}
			});
		}).listen(this.port, function(){
			console.log('server has started on port ' + self.port);
		});
		process.on('SIGINT', function(){
			self.stop();
			console.log('shutting down SIGINT');
			if(runningServerCount === 0){
				process.exit(1);
			}
		});
		process.on('SIGTERM', function(){
			self.stop();
			console.log('shutting down SIGTERM');
			if(runningServerCount === 0){
				process.exit(1);
			}
		});
		return this.server;
	}
};
function reconnect(message, callback){
	setTimeout(function(){
		sendMessageRecursively(message, callback);
	}, 2*1000);
}
function sendMessageOnce(message, callback){
	if(!message) return;
	var socket = net.connect(message.header.endpoint.port, message.header.endpoint.host, function(){
		socket.end(JSON.stringify(message), 'utf-8');
	});
	var result = '';
	socket.on('data', function(data){
		result += data.toString();
	});
	socket.on('error', function(err){
		if(callback) callback(err, null);
		console.log('error occurred when sending message once', err);
	});
	socket.on('close', function(hadError){
		if(hadError) console.log('had error and closed');
		if(callback) callback(null, result ? JSON.parse(result) : null);
	});
}
function sendMessageRecursively(message, callback){
	if(!message) return;
	if(!message.header.reconnectLimit) message.header.reconnectLimit = 5;
	if(!message.header.tried) message.header.tried = 0;
	var socket = net.connect(message.header.endpoint.port, message.header.endpoint.host, function(){
		socket.write(JSON.stringify(message), 'utf-8');
	});
	socket.on('error', function(err){
		if(err.errno === 'ECONNREFUSED'){
			message.header.tried++;
			if(message.header.tried < message.header.reconnectLimit){
				reconnect(message, callback);
			}
		}else console.log('error occurred', err);
	});
	socket.on('close', function(hadError){
		if(!hadError) return;
		message.header.tried++;
		if(message.header.tried < message.header.reconnectLimit){
			reconnect(message, callback);
		}
	});
	socket.on('data', function(data){
		if(callback) sendMessageRecursively(callback(), callback);
		socket.end();
	});
}

module.exports = {
	Server: Server
	, Publisher: Publisher
	, Client: Client
	, Subscriber: Subscriber
};
