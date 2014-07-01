var socketio = require('socket.io');

var port = process.argv[2] || 3636;
var io = socketio.listen(port);

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
        var user = users[socket.id].name;
        delete users[socket.id];
        io.sockets.emit('userDisconnect', {
            user: user
        });
    });

    socket.on('send', function (data) {
        io.sockets.emit('message', data);
    });

    socket.on('change', function (data) {
        users[socket.id].name = data.name;
    });

    socket.on('requestUsers', function (data) {
        var user = getUser(data.from);
        if (!user) return;

        var list = [];
        for (var i in users) {
            list.push(users[i].name);
        }

        user.sock.emit('showUsers', {
            users: list
        })
    });

    socket.on('fileRequestResponse', function (data) {

        var user = getUser(data.from);

        if (data.to == 'all')
            user = 'all';

        if (!user) return;

        if (user !== 'all') {
            user.sock.emit('fileRequestResponse', data);
        } else {
            io.sockets.sockets.forEach(function (sock) {
                if (socket.id !== sock.id) {
                    sock.emit('fileRequestResponse', data);
                }
            });
        }
    });

    socket.on('receiveFile', function (data) {

        var user = getUser(data.to);

        if (data.to == 'all')
            user = 'all';

        if (!user) return;

        if (user !== 'all') {
            user.sock.emit('receiveFile', data);
        } else {
            io.sockets.sockets.forEach(function (sock) {
                if (socket.id !== sock.id) {
                    sock.emit('receiveFile', data);
                }
            });
        }
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

    socket.emit('message', {
        type: 'chat',
        nick: 'server',
        message: "/help for available commands"
    });

});

console.log('Server running on localhost:' + port);