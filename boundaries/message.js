var Uuid = require('node-uuid');
function Message(body, header){
	this.header = header;
	this.header.queueName = header.queueName || null;
	this.header.id = header.id || Uuid.v4();
	this.body = body;
}
module.exports = Message;
