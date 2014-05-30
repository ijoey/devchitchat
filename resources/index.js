var Resource = require('../resource');
var Datastore = require('nedb');
var messagesPath = process.env.DATA_PATH + '/messages.db';
module.exports = function index(app){
	var self = new Resource();
	self.title = "Dev Chit Chat";
	self.js.push("index");
	self.css.push("index");
	function byDate(a, b){
		if(a.time === b.time) return 0;
		if(a.time > b.time) return -1;
		return 1;
	}
	app.get("/(index)?.:format?", function(req, resp, next){
		if(!req.user) return resp.represent("index/index", self, {session: req.session}, next);
		var repo = new Datastore({filename: messagePath, autoload: true};
		var today = new Date();
		today = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
		repo.find({"time": {$gte: today.getTime()}}, function(err, doc){
				var list = [];
				for(var key in doc){
					var obj = doc[key];
					if(!obj.author.username) obj.author.username = '';
					list.push(obj);
				}
				list.sort(byDate);
				resp.represent('index/index', self, list, next);
			});
		});
	});
	return self;
};