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
	app.get('/', function(req, resp, next){		
		if(!req.user) return resp.represent("index/index", self, {session: req.session}, next);
		var repo = new Datastore({filename: messagesPath, autoload: true});
		var today = new Date();
		today = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
		repo.find({"time": {$gte: today.getTime()}}, function(err, docs){
			if(err) console.log(err);
			resp.represent('index/index', self, docs, next);
		});
	});
	return self;
};