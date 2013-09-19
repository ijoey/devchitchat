(function(){
	var messages = [];
	var system = {};
	system.message = function (from, msg) {
		messages.push({from: from, message: msg});
	  $('#lines').append($('<p>').append($('<b>').text(from), msg));
	};
	system.connected = function(){
  	  $('#chat').addClass('connected');
	};
	system.announcement = function(message){
  	  $('#lines').append($('<p>').append($('<em>').text(message)));
	};
	system.nicknames = function (nicknames) {
	  $('#nicknames').empty().append($('<span>Online: </span>'));
	  for (var i in nicknames) {
	    $('#nicknames').append($('<b>').text(nicknames[i]));
	  }
	};
	system.reconnect = function () {
	  $('#lines').remove();
	  message('System', 'Reconnected to the server');
	};
	system.reconnecting = function () {
	  message('System', 'Attempting to re-connect to the server');
	};
	system.error = function (e) {
	  message('System', e ? e : 'A unknown error occurred');
	};
	
	var socket = io.connect();
	socket.on('connect', system.connected);
	socket.on('announcement', system.announcement);
	socket.on('nicknames', system.nicknames);
	socket.on('user message', system.message);
	socket.on('reconnect', system.reconnect);
	socket.on('reconnecting', system.reconnecting);
	socket.on('error', system.error);

	// dom manipulation
	$(function () {
	  $('#set-nickname').submit(function (ev) {
	    socket.emit('nickname', $('#nick').val(), function (set) {
	      if (!set) {
	        clear();
	        return $('#chat').addClass('nickname-set');
	      }
	      $('#nickname-err').css('visibility', 'visible');
	    });
	    return false;
	  });

	  $('#send-message').submit(function () {
	    controller.message('me', $('#message').val());
	    socket.emit('user message', $('#message').val());
	    clear();
	    $('#lines').get(0).scrollTop = 10000000;
	    return false;
	  });

	  function clear () {
	    $('#message').val('').focus();
	  };
	});
})();