var test = require("tap").test;
var bus = null;
var Commands = require('../app/commands/');
test("inprocbus", function (t) {
	bus = require('../boundaries/inprocbus');
	bus.start();
	bus.iHandle('test.message', {
		handle: function(command){
			bus.stop();
			t.ok(command.body.id === 1, "Handle command");
			t.end();
		}
	});
	var command = new Commands.Command({id:1});
	command.header.name = 'test.message';
	bus.send(command);
});
