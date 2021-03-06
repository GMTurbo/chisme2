//TODO
/*

  - emoji
  - notification sounds
  - blink prompt on new message
  - Capital names have issues with file sending
  - set user states (afk, online)
  - timestamp user messages
  - overwrite bug (occurs intermittenly) - multiline issue
  
*/

var socketio = require('socket.io-client'),
    readline = require('readline'),
    util = require('util'),
    color = require('ansi-color').set,
    args = require('minimist')(process.argv.slice(2));

var fs = require('fs'),
    through = require('through'),
    path = require('path');

var exec = require('child_process').exec;

var figlet = require('figlet');

var zlib = require('zlib');
var gunzip = null;
var sfx = null;

try {
    sfx = require("sfx");
} catch (e) {
    //you're running windows eh?
}

var nick;

var port = args.port || 8080;
var server = args.server || 'http://lannisport-nodejs-70776.usw1.nitrousbox.com';
var fullServer = server + ':' + port;

var socket = socketio.connect(fullServer);

socket.on('connect', function(data) {
    console_out(color('successfully connected :)', 'cyan_bg'));
});

//var socket = socketio.connect('http://lannisport-nodejs-70776.usw1.nitrousbox.com:8080/');
var rl = readline.createInterface(process.stdin, process.stdout);


/***************READLINE****************/

rl.question("Enter a username: ", function(name) {
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

rl.on('line', function(line) {
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

var buff=0;
var onData = function(buff, fileSize) {
    // var count = 0;
    return function(data) {
        if (!data) {

            socket.emit('sendDataDone', {
                type: 'data',
                chunk: null
            });

            console_out(color('file sent', 'cyan_bg'));

        } else {


            buff += data.length;
            //if(count % 10 === 0){
            printProgress(buff, fileSize);
            //}
            socket.emit('sendData', {
                type: 'data',
                chunk: data
            });

        }
        //count++;
    };
};

var onEnd = function() {
    socket.emit('sendDataDone', {
        type: 'data',
        chunk: null
    });
    console_out(color('file sent', 'cyan_bg'));
    buff = 0;
};



/***************SOCKETIO****************/

socket.on('message', function(data) {
    var leader;

    if (data.type == 'chat' && data.nick != nick) {
        leader = color('<' + data.nick
            /*+ (function () {
            return data.nick === nick ? '(me)' : '';
        })() */
            + '>', 'green');
        console_out(leader + data.message);
        beep();
    } else if (data.type == 'notice') {
        console_out(color(data.message, 'cyan'));
    } else if (data.type == 'tell' && (data.to == nick || data.from == nick) || data.to === 'all') {
        leader = color('[' + data.from + '->' + data.to + ']', 'magenta_bg');
        console_out(leader + data.message);
    } else if (data.type == 'emote') {
        console_out(color(data.message, 'cyan'));
    }
});

socket.on('showUsers', function(data) {
    console_out(color('active users:', 'green_bg'))
    data.users.forEach(function(user) {
        console_out(color(user, 'green'));
    });
});

var file = {
    name: '',
    stream: null,
    size: 0
};

socket.on('userDisconnect', function(data) {
    console_out(color(data.user + ' left :(', 'red_bg'));
});

socket.on('receiveFile', function(data) {
    rl.question(color(data.from + " wants to send you " + data.filename + ". Accept? (y/n)", 'cyan_bg'), function(response) {
        data.send = response.toLowerCase() === 'y';
        //console.dir(data);
        socket.emit('fileRequestResponse', data);
        rl.prompt(true);
    });
});

socket.on('dataBegin', function(data) {
    console_out(color('receiving data', 'blue_bg'));
    file.name = path.basename(data.filename);
    file.size = data.size;
    file.progress = 0;
    if (!fs.existsSync('./downloads/')) {
        fs.mkdirSync('./downloads');
    }
    var filepath = './downloads/' + file.name;

    file.stream = fs.createWriteStream(filepath, {});

    file.stream.on('error', function(err) {
        console.log(err);
        file.stream.destroy();
    });
    
    file.stream.on('close', function() {
      //console.log('file.stream stream closed');
      file.stream.destroy();
      file.stream.removeAllListeners();
      file = {
        name: '',
        stream: null,
        size: 0
      };
      
    });
    
    gunzip = zlib.createGunzip();

});


var datalength = 0;

socket.on('data', function(data) {
    printProgress(datalength, file.size);
    gunzip.write(data.chunk);
    datalength+=data.chunk.length;
});

socket.on('dataEnd', function(data) {
    console_out(color('file tranfer complete', 'blue_bg'));
    counter = 0;
    gunzip.end();
    gunzip.pipe(file.stream);
    gunzip.on('close', function(){
      //console.log('gunzip stream closed');
      gunzip.removeAllListeners();
      gunzip = null;
    })
    
      
    
    datalength = 0;
});


/***************UTILS****************/

var humanFileSize = function(size) {
    if (!size) return '0 B';
    var i = Math.floor(Math.log(size) / Math.log(1024));
    return (size / Math.pow(1024, i)).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
};

var printProgress = function(curr, total) {
    var percent = (curr / total);
    // console_out('progress -> ' +  * 100).toPrecision(3) + '%');
    var twens_percent = Math.ceil(percent * 25);
    var buf = [];
    buf.push("[");
    buf.push("==============================".slice(0, twens_percent));
    buf.push(twens_percent ? ">" : " ");
    buf.push("                              ".slice(0, 25 - twens_percent));
    buf.push("]");
    buf.push("  ");
    buf.push((percent * 100).toPrecision(3) + "% received (" + humanFileSize(percent * total) + ")");
    var ending = /^win/.test(process.platform) ? '\033[0G' : '\r';
    process.stdout.write(color(buf.join(""), 'cyan_bg') + ending);
    //console_out(color(buf.join(""), 'cyan_bg') + ending);
}

var console_out = function(msg) {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    if (process.platform === 'win32') {
        //console.log('\033[2J');
    }
    console.log(msg);
    rl.prompt(true);
};

function clearLog(callback) {
    var cmd = /^win/.test(process.platform) ? '\u001b[2J\u001b[0;0H' : '\033[2J';
    console.log(cmd);
}

/***************AUDIO****************/
var beep = function() {

    if (/^win/.test(process.platform)) {
        exec('powershell -c (New-Object Media.SoundPlayer "notification.wav").PlaySync();', function(error, stdout, stderr) {
            // output is in stdout
        });
    } else if (sfx) {
        sfx.play("ping");
    }
};

/***************COMMANDS****************/


var chat_command = function(cmd, arg) {

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
            //console.dir([to, file]);
            // var self = this;
            fs.exists(file, function(exists) {
                if (exists) {

                    //socket.removeListener('fileRequestResponse');

                    socket.on('fileRequestResponse', begin(file, to, nick, through(onData(0, fs.statSync(file)["size"]), onEnd), socket));

                    socket.emit('receiveFile', {
                        to: to,
                        from: nick,
                        filename: path.basename(file)
                    });
                    console_out(color('waiting for response...', 'blue_bg'));
                } else {
                    console_out(color('could not find ' + file, 'red_bg'));
                }
            })
            break;

        case 'users':

            socket.emit('requestUsers', {
                from: nick
            });

            break;

        case 'clear':

            clearLog();

            break;

        case 'help':

            var buff = [];
            buff.push(color('command list:', 'magenta_bg'));
            buff.push(color('\t/nick -> change nick name - ex: /nick jesus', 'magenta'));
            buff.push(color('\t/msg -> private message - ex: /msg {user} hi', 'magenta'));
            buff.push(color('\t/me -> get your nick name', 'magenta'));
            buff.push(color('\t/send -> send file - ex: /send {user} {file}', 'magenta'));
            buff.push(color('\t/users -> list all users', 'magenta'));
            buff.push(color('\t/clear -> clear screen', 'magenta'));
            buff.push(color('\t/ascii-> ASCI text - ex: /ascii {user} hi', 'magenta'));
            console_out(buff.join('\n'));

            break;

        case 'ascii':

            var to = arg.match(/[a-z]+\b/i)[0];
            var message = arg.substr(to.length, arg.length);

            figlet(message, function(err, data) {

                if (err) {
                    console.log('Something went wrong...');
                    console.dir(err);
                    return;
                }

                socket.emit('send', {
                    type: 'tell',
                    message: color('\n' + data, 'magenta_bg'),
                    to: to,
                    from: nick
                });
                //  socket.emit('sendShout', {to:to, message:data});
            });

            break;

        default:
            console_out(color('command not supported', 'red_bg'));
            break;
    }

};

var begin = function(file, to, from, thr, sock) {

    return function(data) {
        //console.log('receiving response')
        if (data.send) {

            var filesize = fs.statSync(file)["size"];
            sock.emit('sendStart', {
                filename: path.basename(file),
                size: filesize,
                to: to,
                from: from
            });
            
            var writeStream = fs.createReadStream(file);
            
            writeStream.on('close', function() {
              //console.log('writeStream stream closed');
              writeStream.destroy();
              writeStream.removeAllListeners();
            });
            
            zipper = zlib.createGzip({level:9});
            zipper.on('close', function() {
              //console.log('zipper stream closed');
              zipper.removeAllListeners();
              zipper = null;
              
            });
            
            writeStream.pipe(zipper).pipe(thr);

        } else {

            console_out(color(to + ' rejected ' + path.basename(file), 'red_bg'));

        }

        sock.removeListener('fileRequestResponse');

    };
};

console_out(color('attempting to connect to ' + fullServer, 'magenta_bg'));
