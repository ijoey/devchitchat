var EventEmitter = require('events').EventEmitter;
var emitter = new EventEmitter();
var Uuid = require('node-uuid');
var handlers = {};
module.exports = {
	send: function(command){
		command.header.uuid = Uuid.v4();
    emitter.emit(command.header.name, command);
	},
	publish: function(event){
		event.header.uuid = Uuid.v4();
    emitter.emit(event.header.name, event);
	},
	iHandle: function(name, handler){
		if(handlers[name]){
			throw new Error(name + ' is already handled');
		}
		handlers[name] = handler;
    emitter.on(name, handler.handle.bind(handler));
	},
	iSubscribeTo: function(name, publisher, subscriber){
    emitter.on(name, subscriber.update.bind(subscriber));
	},
	start: function(){
	},
	stop: function(){
	}
};
