var Observable = require('./observable');
function Queue(config){
	this.config = config;
	this.observable = Observable();
	this.innerList = [];
	Object.defineProperty(this, 'length', {
		get: function(){
			return this.innerList.length;
		}.bind(this),
		enumerable: true
	});
}
Queue.prototype = {
	push: function push(item){
		this.innerList.push(item);
		this.observable.changed('push', null, item);
	},
	shift: function(){
		var item = this.innerList.shift();
		this.observable.changed('shift', item, null);
		return item;
	},
	observe: function observe(key, observer){
		this.observable.observe(key, observer);
	},
	stopObserving: function stopObserving(observer){
		this.observable.stopObserving(observer);
	},
	release: function release(){
		this.observable.release();
	}
};
module.exports = Queue;