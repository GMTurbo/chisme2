var socketio = require('socket.io');

var io = socketio.listen(3636);

io.sockets.on('connection', function(socket){
	console.log('new incoming connection');
	socket.on('send', function(data){
		io.sockets.emit('message', data);
	});
});

console.log('Server running on localhost:3636');