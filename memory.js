    // Requires
var express = require('express'),
    app = express.createServer(),

    io = require('socket.io').listen(app),

    // Data
    games = {}
;

/**
 * Returns a two-dimensional array of cards to start off a game.
 */
function generateCards(pairs) {

}

app.use(app.router);
app.use(express.static(__dirname + '/public'));

app.listen(3000);

io.sockets.on('connection', function (socket) {
    socket.on('enter-game', function (data) {
        data.name = 'game_' + data.name;

        if (!games.hasOwnProperty(data.name)) {
            // Setup game if it doesn't exist
            games[data.name] = {
                exposed: {
                    name: data.name,
                    started: Math.round((new Date()).valueOf() / 1000),
                    players: [data.player]
                },
                hidden: {
                    cards: generateCards(8)
                }
            };
        } else {
            // Join game if it does
            games[data.name].exposed.players.push(data.player);
        }

        // Set player stats
        socket.set('name', data.player);
        socket.set('score', 0);

        // Join broadcasts for the game room
        socket.join(data.name);

        // Return data
        socket.emit('game-info', games[data.name].exposed);
    });
});
