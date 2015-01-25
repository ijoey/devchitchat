(function(n, win){
	n.CreateMenu = function(container, model, delegate){
		var self = {
			container: container
			, delegate: delegate
			, model: model
			, show: function(){
				this.container.style['left'] = '0px';
			}
			, hide: function(){
				this.container.style['left'] = '-100px';
			}
			, handleEvent: function(e){
				if(!e.target.href) return;
				e.preventDefault();
				this.delegate.wasSelected(e.target);
			}
		};
		Object.defineProperty(self, 'isHidden', {
			get: function(){
				return parseInt(self.container.style['left'].replace('px', '')) !== 0;;
			}
			, enumerable: true
		});
		self.container.addEventListener('click', self, true);
		return self;
	};
	
	n.CreateMenuButton = function(container, model, delegate){
		var self = {
			container: container
			, model: model
			, delegate: delegate
			, toggle: function(){
				if(this.isOpened) this.close();
				else this.open();
			}
			, close: function(){
				this.container.style['left'] = this.defaultLeft + 'px';
				this.delegate.shouldClose(this);
			}
			, open: function(){
				this.container.style['left'] = '100px';
				this.delegate.shouldOpen(this);
			}
			, handleEvent: function(e){
				if(this[e.type]) this[e.type](e);
			}
			, click: function(e){
				this.toggle();
			}
		};
		self.defaultLeft = self.container.getBoundingClientRect().left;
		self.container.addEventListener('click', self, true);
		Object.defineProperty(self, 'isOpened', {
			get: function(){
				return self.container.getBoundingClientRect().left !== self.defaultLeft;
			}
			, enumerable: true
		});
		return self;
	};
		
	n.CreateDocument = function(container, model, delegate){
		var self = {
			container: container
			, model: model
			, delegate: delegate
			, slideRight: function(){
				this.container.style['marginLeft'] = '100px';
			}
			, slideLeft: function(){
				this.container.style['marginLeft'] = 'auto';				
			}
			, menuHasOpened: function(publisher, view){
				this.slideRight();
			}
			, menuHasClosed: function(publisher, view){
				this.slideLeft();
			}
		};
		n.NotificationCenter.subscribe('menuHasOpened', self, null);
		n.NotificationCenter.subscribe('menuHasClosed', self, null);
		return self;
	};

	n.CreateUrlListener = function(model, delegate){
		var self = {
			delegate: delegate
			, model: model
			, update: function(key, old, v){
				var xhr = new XMLHttpRequest();
				var self = this;
				var url = this.addExtension(v, 'phtml');
				xhr.open("GET", url, true);
				xhr.onload = function(e){self.onload(e);};
				xhr.send();
			}
			, onload: function(e){
				this.delegate.pageWasRequested(this.model, e.target.responseText);
			}
			, addExtension: function(url, ext){
				var parts = url.split('/');
				var last = parts[parts.length-1];
				if(last.length === 0) url = 'index';
				if(!/\.(.*)$/.test(last)){
					url += '.{ext}'.replace(/{ext}/, ext);
				}
				return url;
			}
		};
		
		self.model.subscribe('url', self.update.bind(self));
		return self;
	};

	var app = (function(win){
		var menu = new n.Observable({});
		var page = new n.Observable({url: window.location.href});
		var self = {
			views: []
			, wasSelected: function(link){
				n.NotificationCenter.publish('pageWasSelected', this, page);
				return window.location = link.href;

				if(link.href.indexOf('logout') > -1){
					return window.location = link.href;
				}
				if(link.href.indexOf('/page') > -1){
					return window.location = link.href;
				}
				if(/\/(index)?$/.test(link.href)){
					return window.location.href = '/';
				}
				window.history.pushState(null, link.title, link.href);
				page.url = link.href;
				n.NotificationCenter.publish('pageWasSelected', this, page);
			}
			, pageWasRequested: function(p, response){
				var main = document.getElementById('main');
				main.innerHTML = response;
				var background = main.querySelector('#background');
				if(background){
					document.body.style['backgroundImage'] = 'url("' + background.value + '")';	
				}
			}
			, shouldOpen: function(button){
				this.views.forEach(function(v){
					if(v.container.id === 'menu'){
						v.show();
						n.NotificationCenter.publish('menuHasOpened', this, v);
					}
				}.bind(this));
			}
			, shouldClose: function(button){
				this.views.forEach(function(v){
					if(v.container.id === 'menu'){
						v.hide();						
						n.NotificationCenter.publish('menuHasClosed', this, v);
					}
				}.bind(this));
			}
		};
		//var listener = n.CreateUrlListener(page, self);
		self.views.push(n.CreateMenuButton(document.getElementById('menuButton'), menu, self));
		self.views.push(n.CreateMenu(document.getElementById('menu'), menu, self));
		self.views.push(n.CreateDocument(document.getElementById('main'), page, self));
		// window.addEventListener('popstate', function(e){
// 			console.log('popstate', e);
// 		}, true);
		
		return self;
	})(win);
})(MM, window);
