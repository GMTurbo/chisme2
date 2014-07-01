//TODO
/*

  - automatically create downloads folder
  - sending progress reporting
  - show file transfer response to sender
  - emoji
  

*/
var socketio = require('socket.io-client'),
    readline = require('readline'),
    util = require('util'),
    color = require('ansi-color').set;

var fs = require('fs'),
    through = require('through'),
    path = require('path');

var nick;

var port = process.argv[2] || 3636;

var socket = socketio.connect('http://lannisport-nodejs-70776.usw1.nitrousbox.com:8080/');
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

//var buff = 0, fileSize = 0;

var onData = function (buff, fileSize) {
    
    return function(data){
      if (!data) {
  
          socket.emit('sendDataDone', {
              type: 'data',
              chunk: null
          });
  
          console_out('file sent');
  
      } else {
          
          buff += data.length;
          console_out('progress -> ' + ((buff / fileSize) * 100).toPrecision(3) + '%');
          socket.emit('sendData', {
              type: 'data',
              chunk: data
          });
  
      }
    };
};

var onEnd = function () {
    socket.emit('sendDataDone', {
        type: 'data',
        chunk: null
    });
    console_out('file sent');
};

/***************SOCKETIO****************/

socket.on('message', function (data) {
    var leader;

    if (data.type == 'chat' && data.nick != nick) {
        leader = color('<' + data.nick /*+ (function () {
            return data.nick === nick ? '(me)' : '';
        })() */ + '>', 'green');
        console_out(leader + data.message);
    } else if (data.type == 'notice') {
        console_out(color(data.message, 'cyan'));
    } else if (data.type == 'tell' && (data.to == nick || data.from == nick)) {
        leader = color('[' + data.from + '->' + data.to + ']', 'magenta_bg');
        console_out(leader + data.message);
    } else if (data.type == 'emote') {
        console_out(color(data.message, 'cyan'));
    }
});

socket.on('showUsers', function(data){
  console_out(color('active users:', 'green_bg'))
  data.users.forEach(function(user){ console_out(color(user, 'green')); } );
});

var file = {
    name: '',
    stream: null,
    size: 0
};

socket.on('userDisconnect', function (data) {
    console_out(color( data.user  + ' left :(', 'red_bg'));
});

socket.on('receiveFile', function (data) {
    rl.question(data.from + " wants to send you " + data.filename + ". Accept? (y/n)", function (response) {
        data.send = response.toLowerCase() === 'y';
        console.dir(data);
        socket.emit('fileRequestResponse', data);
        rl.prompt(true);
    });
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

    console_out('progress -> ' + ((file.stream.bytesWritten / file.size) * 100).toPrecision(3) + '%');
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

        var to = arg.match(/[a-z]+\b/i)[0];
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
        console_out(color('your name is ' + nick, 'blue_bg'));
        break;

    case 'send':
        // console.log('sending file');
        var to = arg.match(/[a-z]+\b/)[0];
        var file = arg.substr(to.length + 1, arg.length);
        file = file.replace(/"/g, "");
        file = path.normalize(file);
        console.dir([to, file]);
        // var self = this;
        fs.exists(file, function (exists) {
            if (exists) {

                //socket.removeListener('fileRequestResponse');

                socket.on('fileRequestResponse', begin(file, to, nick, through(onData(0,fs.statSync(file)["size"]), onEnd), socket));

                socket.emit('receiveFile', {
                    to: to,
                    from: nick,
                    filename: path.basename(file)
                });
            }
        })
        break;
        
        case 'users':
          
          socket.emit('requestUsers', {
             from: nick
          });
          
          break;
    }

};

var begin = function (file, to, from, thr, sock) {

    return function (data) {
        console.log('receiving response')
        if (data.send) {
          
            fileSize = fs.statSync(file)["size"];
            buff = 0;
            sock.emit('sendStart', {
                filename: path.basename(file),
                size: fileSize,
                to: to,
                from: from
            });

            fs.createReadStream(file).pipe(thr);

        }else{
          
          console_out(to + ' rejected ' + path.basename(file));
          
        }

        sock.removeListener('fileRequestResponse');

    };
};