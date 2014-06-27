var socketio = require('socket.io-client'),
    readline = require('readline'),
    util = require('util'),
    color = require('ansi-color').set;

var fs = require('fs'),
    through = require('through'),
    path = require('path');

var nick;
var socket = socketio.connect('http://localhost:3636');
var rl = readline.createInterface(process.stdin, process.stdout);


/***************READLINE****************/

rl.question("Enter a username: ", function (name) {
    nick = name;
    var msg = nick + " has joined the chat";
    socket.emit('change', {
        name: nick
    });
    socket.emit('send', {
        type: 'notice',
        message: msg
    });
    rl.prompt(true);
});

rl.on('line', function (line) {
    if (line[0] == "/" && line.length > 1) {
        var cmd = line.match(/[a-z]+\b/)[0];
        var arg = line.substr(cmd.length + 2, line.length);
        chat_command(cmd, arg);
    } else {
        socket.emit('send', {
            type: 'chat',
            message: line,
            nick: nick
        });
        rl.prompt(true);
    }
});

/***************THROUGH****************/
var onData = function (data) {
    socket.emit('sendData', {
        type: 'data',
        chunk: data
    });
};

var onEnd = function () {
    socket.emit('sendDataDone', {
        type: 'data',
        chunk: null
    });
};

var tr = through(onData, onEnd);
/***************SOCKETIO****************/

socket.on('message', function (data) {
    var leader;

    if (data.type == 'chat' && data.nick != nick) {
        leader = color('<' + data.nick + '>', 'green');
        console_out(leader + data.message);
    } else if (data.type == 'notice') {
        console_out(color(data.message, 'cyan'));
    } else if (data.type == 'tell' && data.to == nick) {
        leader = color('[' + data.from + '->' + data.to + ']', 'blue');
        console_out(leader + data.message);
    } else if (data.type == 'emote') {
        console_out(color(data.message, 'cyan'));
    }
});

var file = {
    name: '',
    stream: null,
    size: 0
};

socket.on('userDisconnect', function () {
    console_out(color('someone left :(', 'red'));
});

socket.on('dataBegin', function (data) {
    console.log('receiving data');
    file.name = path.basename(data.filename);
    file.size = data.size;
    file.progress = 0;
    var filepath = './downloads/' + file.name;

    file.stream = fs.createWriteStream(filepath, {});

    file.stream.on('error', function (err) {
        console.log(err);
    });

});

socket.on('data', function (data) {

    console_out('progress -> ' + (file.stream.bytesWritten / file.size) * 100);
    file.stream.write(data.chunk);

});

socket.on('dataEnd', function (data) {
    console_out('saving file');
    file.stream.end();
});

/***************UTILS****************/

var console_out = function (msg) {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    if (process.platform === 'win32') {
        //  util.print("\u001b[2J\u001b[0;0H");
    }
    console.log(msg);
    rl.prompt(true);
};

/***************COMMANDS****************/

var chat_command = function (cmd, arg) {

    switch (cmd) {

    case 'nick':
        var notice = nick + ' changed their name to ' + arg;
        nick = arg;
        socket.emit('change', {
            name: nick
        });
        socket.emit('send', {
            type: 'notice',
            message: notice
        });
        break;

    case 'msg':

        var to = arg.match(/[a-zA-Z]+\b/)[0];
        var message = arg.substr(to.length, arg.length);
        socket.emit('send', {
            type: 'tell',
            message: message,
            to: to,
            from: nick
        });
        rl.prompt(true);

        break;

    case 'me':
        console_out('that is not a valid command');
        break;

    case 'send':
        console.log('sending file');
        var to = arg.match(/[a-z]+\b/)[0];
        var file = arg.substr(to.length + 1, arg.length);
        console.dir([to, file]);
        fs.exists(file, function (exists) {
            if (exists) {
                console.log('sending file');
                socket.emit('sendStart', {
                    filename: path.basename(file),
                    size: fs.statSync(file)["size"],
                    to: to,
                    from: nick
                });
                fs.createReadStream(file).pipe(tr);
            }
        })
        break;
    }

};