(function(n, win){
    n.ReconnectingCounterView = function(container, model, delegate){
		var self = {
			container: container,
			model: model,
			delegate: delegate,
			show: function show(){
				this.container.style.display = 'block';
			},
			hide: function hide(){
				this.container.style.display = 'none';
			},
			update: function update(key, old, v){
				if(v === 0){
					this.hide();
				}else{
					this.show();
				}
				this.container.innerHTML = v;
			}
		};
		self.model.subscribe('times', self.update.bind(self));
		return self;
	};
})(MM, window);