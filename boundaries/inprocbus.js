var commands = [];
var events = [];
var handlers = {};
var subscribers = {};
var subscriptions = {};
function Subscription(name, publisher, subscriber){
	this.id = (new Date()).getTime();
	this.header = {endpoint: publisher, name: name};
	this.subscriber = subscriber;
	this.type = 'subscription';
}

module.exports = {
	send: function(command){
		commands.push(command);
	}
	,publish: function(event){
		events.push(event);
	}
	, iHandle: function(name, handler){
		if(handlers[name]) throw new Error(name + ' is already handled');
		handlers[name] = handler;
	}
	, iSubscribeTo: function(name, publisher, subscriber){
		if(!subscriptions[name]) subscriptions[name] = [];
		if(!subscribers[name]) subscribers[name] = [];
		subscribers[name].push(subscriber);
		subscriptions[name].push(new Subscription(name, publisher, subscriber));
	}
	, commandInterval: null
	, eventInterval: null
	, start: function(){
		this.commandInterval = setInterval(function(){
			var command = null;
			if(commands.length === 0) return;
			command = commands.shift();
			if(handlers[command.header.name]){
				handlers[command.header.name].handle(command);
			}
		}, 100);
		this.eventInterval = setInterval(function(){
			var event = null;
			if(events.length === 0){
				return;
			}
			event = events.shift();
			if(!subscribers[event.header.name]){
				return;
			}
			for(var i = 0; i < subscribers[event.header.name].length; i++){
				subscribers[event.header.name][i].update(event);
			}
		}, 100);
	}
};