module.exports = function Resource(){
	this.layout = "default";
	this.title = "Default title";
	this.js = [];
	this.css = [];
	this.header = {};
	this.user = null;
	this.status = {code: 200, description: "Ok"};
	return this;
};
