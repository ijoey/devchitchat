if(!MM) var MM = {};
(function(namespace){
	namespace.Device = (function Device(){
		this.CANTOUCH = ("createTouch" in document);
		this.MOUSEDOWN = this.CANTOUCH ? "touchstart" : "mousedown";
		this.MOUSEMOVE = this.CANTOUCH ? "touchmove" : "mousemove";
		this.MOUSEUP = this.CANTOUCH ? "touchend" : "mouseup";
		this.CLICK = "click";
		this.DOUBLECLICK = "dblclick";
		this.KEYUP = "keyup";
		this.SEARCH = "search";
		this.INPUT = "input";
		this.BLUR = "blur";
		this.UNLOAD = "unload";
		this.CHANGE = "change";
		this.SCROLL = "scroll";
		this.FOCUS = "focus";
		return this;
	})();
	namespace.NotificationCenter = (function(){
		var observers = [];
		var NotificationCenter = {
			publish: function publish(notification, publisher, info){
				var ubounds = observers.length;
				var i = 0;
				for(i; i<ubounds; i++){
					if(!observers[i]) continue;
					if(observers[i].notification !== notification) continue;
					if(observers[i].publisher !== null && observers[i].publisher !== publisher) continue;
					try{
						observers[i].observer[notification].apply(observers[i].observer, [publisher, info]);
					}catch(e){
						console.log([e, observers[i]]);
					}
				}
			}
			, subscribe: function subscribe(notification, observer, publisher){
				observers.push({"notification": notification, "observer":observer, "publisher":publisher});
			}
			, unsubscribe: function unsubscribe(notification, observer, publisher){
				var i = 0;
				var ubounds = observers.length;
				for(i; i<ubounds; i++){
					if(observers[i].observer == observer && observers[i].notification == notification){
						observers.splice(i, 1);
						break;
					}
				}
			}
			, release: function(){
				var observer = null;
				while(observer = observers.pop()){
					if(observer.release) observer.release();
				}
			}
		};
		return NotificationCenter;
	})();
	namespace.Observable = function Observable(obj){
		this.dependents = {};
		if(!obj) return;
		var key = null;
		var keys = Object.keys(obj);
		var i = 0;
		var ubounds = keys.length;
		var self = this;
		for(i; i < ubounds; i++){
			(function(){
				var attribute = keys[i];
				Object.defineProperty(self, attribute, {
					get: function(){
						return obj[attribute];
					}
					, set: function(v){
						var old = obj[attribute];
						obj[attribute] = v;
						self.changed(attribute, old, v);
					}
					, enumerable: true
				});
			})();
		}
		for(var key in obj){
			if(typeof(obj[key]) === 'function'){
				this[key] = obj[key].bind(this);
			}
		}
	};
	namespace.Observable.prototype = {
		subscribe: function subscribe(key, subscriber){
			if(this.dependents[key] === undefined) this.dependents[key] = [];
			this.dependents[key].push(subscriber);
		}
		, unsubscribe: function unsusbscribe(subscriber){
			for(var key in this.dependents){
				var i = 0;
				var ubounds = this.dependents[key].length;
				for(i; i < ubounds; i++){
					if(this.dependents[key][i] === subscriber){
						this.dependents[key].splice(i, 1);
						if(this.dependents[key].length === 0) delete this.dependents[key];
						break;
					}
				}
			}
		} 
		, changed: function(key, old, v){
			if(this.dependents[key] === undefined) return;
			var i = 0;
			var ubounds = this.dependents[key].length;
			for(i; i<ubounds; i++){
				this.dependents[key][i](key, old, v);
			}
		}
		, release: function(){
			var key = null;
			for(key in this.dependents){
				var dependent = null;
				while(dependent = this.dependents[key].pop()){}
			}
		}
	};

	namespace.Observable.List = function List(){
		this.innerList = [];
		this.counter = 0;
		if(arguments && arguments.length > 0 && arguments[0].length > 0){
			var ubounds = arguments[0].length;
			for(var i = 0; i < ubounds; i++){
				this.innerList.push(arguments[0][i]);
			}
		}
		var self = this;
		Object.defineProperty(this, "length", {
			get: function(){
				return self.innerList.length;
			}
		});
		this.observable = new namespace.Observable();
	};
	namespace.Observable.List.prototype = {
		push: function push(item){
			this.innerList.push(item);
			this.observable.changed("push", null, item);
		}
		, next: function(){
			if(this.counter >= this.innerList.length){
				this.counter = 0;
			}
			var item = this.innerList[this.counter];
			this.counter++;
			return item;
		}
		, pop: function pop(){
			var last = this.innerList.pop();
			this.observable.changed("pop", last, null);
			return last;
		}
		, shift: function shift(){
			var first = this.innerList.shift();
			this.observable.changed("shift", null, first);
			return first;
		}
		, unshift: function unshift(items){
			var length = this.innerList.unshift(items);
			this.observable.changed("unshift", null, items);
			return length;
		}
		, remove: function remove(delegate){
			var i = 0;
			var ubounds = this.innerList.length;
			var deleted = [];
			for(i; i < ubounds; i++){
				if(delegate(i, this.innerList[i])){
					deleted = this.innerList.splice(i, 1);
					this.observable.changed("remove", deleted[0], i);
					break;
				}
			}
			return deleted[0];
		}
		, removeMany: function removeMany(delegate){
			var ubounds = this.innerList.length;
			var i = ubounds-1;
			var deleted = [];
			for(i; i >= 0; i--){
				if(this.innerList[i] && delegate(i, this.innerList[i])){
					deleted.push(this.innerList.splice(i, 1)[0]);
					this.observable.changed("remove", deleted[deleted.length-1], i);
				}
			}
			return deleted;
		}
		, item: function item(i){
			return this.innerList[i];
		}
		, find: function find(delegate){
			var i = 0;
			var ubounds = this.innerList.length;
			for(i; i < ubounds; i++){
				if(delegate(i, this.innerList[i])) return this.innerList[i];
			}
			return null;
		}
		, items: function items(){
			return this.innerList;
		}
		, each: function(fn){
			var i = 0, ubounds = this.innerList.length;
			for(i; i < ubounds; i++){
				fn(i, this.innerList[i]);
			}
		}
		, clear: function clear(){
			while(this.length > 0){
				this.pop();
			}
			this.innerList = [];
		}
		, release: function(){
			var item = null;
			while(item = this.innerList.pop()){}
			this.observable.release();
		}
		, subscribe: function(key, subscriber){
			this.observable.subscribe(key, subscriber);
		}
		, unsubscribe: function(subscriber){
			this.observable.unsubscribe(subscriber);
		}
		, last: function(){
			if(innerList.length === 0) return null;
			return innerList[innerList.length - 1];
		}
	};
	
	namespace.View = function View(container, controller, model){
		this.container = container;
		this.model = model;
		this.controller = controller;
		this.views = [];
	};
	namespace.View.Mixin = function(proto){
		return namespace.Mixin(proto, new namespace.View());
	};
	namespace.View.prototype = {
		release: function release(){
			if(!this.container.parentNode) return;
			this.container.parentNode.removeChild(this.container);
			this.controller.release();
			var view = null;
			while(view = this.views.pop()) view.release();
		}
	};

	namespace.Controller = function Controller(delegate, model){
		this.model = model;
		this.delegate = delegate;
		this.view = null;
	};
	namespace.Controller.Mixin = function(proto){
		return namespace.Mixin(proto, new namespace.Controller());
	};
	namespace.Controller.prototype = {
		release: function(){
			if(this.model.release) this.model.release();
		}
		, setView: function(v){
			if(this.view) this.view.release();
			this.view = v;
		}
	};
	namespace.Mixin = function(proto, obj){
		for(var key in obj){
			if(typeof obj[key] !== 'function') continue;
			if(proto[key]) continue;
			proto[key] = obj[key];
		}
		return proto;
	};
})(MM);