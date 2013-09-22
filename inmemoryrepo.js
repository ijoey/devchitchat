var emitter = new process.EventEmitter();
function InMemoryRepo(name){
	this.name = name;
	this.data = {};
}
function guid(){
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
	    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
	    return v.toString(16);
	});
}

var dbs = [];
InMemoryRepo.new = function(name, callback){
	callback();
	if(dbs[name]) return dbs[name];
	dbs[name] = new InMemoryRepo(name);
	return dbs[name];
};

InMemoryRepo.prototype = {
	on: function(name, observer){
		emitter.on(name, observer);
	}
	, emit: function(name, info){
		emitter.emit(name, info);
	}
	, find: function(query, callback){
		var obj = {};
		if(query.token){
			for(var key in this.data){
				if(this.data[key].token === query.token){
					obj[key] = this.data[key];
					return callback(null, obj);
				}
			}
		}else if(query["profile.username"]){
			for(var key in this.data){
				if(this.data[key].profile.username === query["profile.username"]){
					obj[key] = this.data[key];
					return callback(null, obj);
				}
			}
		}else{
			return callback(null, this.data);
		}
		return callback(null, {});
	}
	, save: function(key, obj, callback){
		if(!key) key = guid();
		this.data[key] = obj;
		console.log('saving to memory->', obj);
		if(callback) callback(null, key);	
	}
};
module.exports = InMemoryRepo;