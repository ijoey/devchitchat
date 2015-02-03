var Queue = require('../lib/queue');
var Fs = require('fs');
var Observable = require('../lib/observable');
var commands = new Queue({name: 'Commands'});
var events = new Queue({name: 'Events'});
var handlers = {};
var subscribers = {};
var subscriptions = {};
var Path = require('path');
var queuePath = __dirname + Path.sep + 'queues' + Path.sep;
var filePathTemplate = queuePath + "{path}.json";
var debug = require('debug')('inprocbus');
var Uuid = require('node-uuid');
function Subscription(name, publisher, subscriber){
	this.time = (new Date()).getTime();
	this.header = {endpoint: publisher, name: name, uuid: Uuid.v4()};
	this.subscriber = subscriber;
	this.type = 'subscription';
}
function createFolderIfDoesntExist(folder){
	if(!Fs.existsSync(folder)){
		Fs.mkdirSync(folder);
	}
}
createFolderIfDoesntExist(queuePath);

commands.observe('push', function(key, old, v){
	createFolderIfDoesntExist(queuePath + v.header.name + Path.sep);
	Fs.writeFile(filePathTemplate.replace(/{path}/, v.header.name + Path.sep + v.header.uuid), JSON.stringify(v), function(err){
		if(err){
			console.error(err);
		}
	});
});

commands.observe('shift', function(key, old, v){
	Fs.unlink(filePathTemplate.replace(/{path}/, old.header.name + Path.sep + old.header.uuid), function(err){
		if(err){
			console.log(err);
		}
	});
});
function flushToDisk(){
	console.log(commands, events);
}
function loadFromDisk(){
	var files = Fs.readdirSync(queuePath);
	files.forEach(function(directory){
		Fs.readdirSync(queuePath + directory + Path.sep).forEach(function(file){
			var text = Fs.readFileSync(queuePath + directory + Path.sep + file, {encoding: "utf-8"});
			try{
				var obj = JSON.parse(text);
				if(obj.type === 'command'){
					commands.push(obj);
				}else if(obj.type === 'events'){
					events.push(obj);
				}
			}catch(e){
			}
		});
	});
}
function sendEvents(){
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
}
function sendCommands(){
	var command = null;
	if(commands.length === 0){
		return;
	}
	command = commands.shift();
	if(handlers[command.header.name]){
		handlers[command.header.name].handle(command);
	}
}
process.on('inprocbus.hasStarted', loadFromDisk);
process.on('inprocbus.hasStopped', flushToDisk);

module.exports = {
	send: function(command){
		command.header.uuid = Uuid.v4();
		commands.push(command);
	},
	publish: function(event){
		event.header.uuid = Uuid.v4();
		events.push(event);
	},
	iHandle: function(name, handler){
		if(handlers[name]){
			throw new Error(name + ' is already handled');
		}
		handlers[name] = handler;
	},
	iSubscribeTo: function(name, publisher, subscriber){
		if(!subscriptions[name]){
			subscriptions[name] = [];
		}
		if(!subscribers[name]){
			subscribers[name] = [];
		}
		subscribers[name].push(subscriber);
		subscriptions[name].push(new Subscription(name, publisher, subscriber));
	},
	commandInterval: null,
	eventInterval: null,
	start: function(){
		process.emit('inprocbus.hasStarted', this);
		this.commandInterval = setInterval(sendCommands, 100);
		this.eventInterval = setInterval(sendEvents, 100);
	},
	stop: function(){
		clearInterval(this.commandInterval);
		clearInterval(this.eventInterval);
		process.emit('inprocbus.hasStopped', this);
	}
};