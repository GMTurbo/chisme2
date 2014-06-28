var socketio = require('socket.io');
var ss = require('socket.io-stream');

var port = process.argv[2] || 3636;

var io = socketio.listen(process.argv[2] || 3636);

var users = {};

var getUser = function (username) {

    for (var i in users) {
        if (users[i].name == username)
            return users[i];
    }

    return null;
};

io.sockets.on('connection', function (socket) {

    users[socket.id] = {
        name: '',
        sock: socket
    };

    socket.on('disconnect', function () {
        delete users[socket.id];
        io.sockets.emit('userDisconnect');
    });

    socket.on('send', function (data) {
        io.sockets.emit('message', data);
    });

    socket.on('change', function (data) {
        users[socket.id].name = data.name;
    });

    var targetUser = null;
    socket.on('sendStart', function (data) {

        targetUser = getUser(data.to);

        if (data.to == 'all')
            targetUser = 'all';

        if (!targetUser) return;

        if (targetUser !== 'all') {
            targetUser.sock.emit('dataBegin', data);
        } else {
            io.sockets.sockets.forEach(function (sock) {
                if (socket.id !== sock.id) {
                    sock.emit('dataBegin', data);
                }
            });
        }

    });

    socket.on('sendData', function (data) {

        if (!targetUser) return;

        if (targetUser !== 'all') {
            targetUser.sock.emit('data', data);
        } else {
            io.sockets.sockets.forEach(function (sock) {
                if (socket.id !== sock.id) {
                    sock.emit('data', data);
                }
            });
        }

    });

    socket.on('sendDataDone', function (data) {

        if (!targetUser) return;

        if (targetUser !== 'all') {
            targetUser.sock.emit('dataEnd', data);
        } else {
            io.sockets.sockets.forEach(function (sock) {
                if (socket.id !== sock.id) {
                    sock.emit('dataEnd', data);
                }
            });
        }

    });

});

console.log('Server running on localhost:' + port);
