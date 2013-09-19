var Device = (function(){
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
var NotificationCenter = (function(){
	var observers = [];
	var self = {
		publish: function(notification, publisher, info){
			var ubounds = observers.length;
			var i = 0;
			for(i; i<ubounds; i++){
				if(!observers[i]) continue;
				if(observers[i].notification != notification) continue;
				if(observers[i].publisher != null && observers[i].publisher != publisher) continue;
				try{
					observers[i].observer[notification].apply(observers[i].observer, [publisher, info]);
				}catch(e){
					console.log([e, observers[i]]);
				}
			}
		}
		, subscribe: function(notification, observer, publisher){
			observers.push({"notification": notification, "observer":observer, "publisher":publisher});
		}
		, unsubscribe: function(notification, observer, publisher){
			var i = 0;
			var ubounds = observers.length;
			for(i; i<ubounds; i++){
				if(observers[i].observer == observer && observers[i].notification == notification){
					observers.splice(i, 1);
					break;
				}
			}
		}
	}
	return self;
})();

var Model = function(obj){
	var dependents = {};
	this.subscribe = function(key, subscriber){
		if(dependents[key] === undefined) dependents[key] = [];
		dependents[key].push(subscriber);
	};
	this.unsubscribe = function(subscriber){
		for(key in dependents){
			var i = 0;
			var ubounds = dependents[key].length;				
			for(i; i < ubounds; i++){
				if(dependents[key][i] === subscriber){
					dependents[key].splice(i, 1);
					if(dependents[key].length === 0) delete dependents[key];
					break;
				}
			}
		}
	};
	this.changed = function(key, old, v){
		if(dependents[key] === undefined) return;
		var i = 0;
		var ubounds = dependents[key].length;
		for(i; i<ubounds; i++){
			dependents[key][i](key, old, v, this);
		}
	};
  return this;
};
var View = function(container, model){
	this.container = container;
	this.model = model;
	this.release = function(){
		
	};
	return this;
};
var Controller = function(delegate, view, model){
	this.model = model;
	this.delegate = delegate;
	this.view = view;
	this.release = function(){
		
	};
	return this;
};