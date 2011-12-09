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
    // TODO: make this random, just a test for now
    return [[1, 1, 2, 2, 3, 3],
            [4, 4, 5, 5, 6, 6],
            [7, 7, 8, 8, 1, 1],
            [2, 2, 3, 3, 4, 4]];

}

function getCard(game, coords) {
    return games[game].hidden.cards[coords.x][coords.y];
}

app.use(app.router);
app.use(express.static(__dirname + '/public'));

app.listen(3000);

io.sockets.on('connection', function (socket) {
    socket.on('enter-game', function (data) {
        data.name = 'game_' + data.name;

        // Setup game if it doesn't exist
        if (!games.hasOwnProperty(data.name)) {
            games[data.name] = {
                exposed: {
                    name: data.name,
                    started: Math.round((new Date()).valueOf() / 1000),
                    players: {}
                },
                hidden: {
                    cards: generateCards(8)
                }
            };
        }

        games[data.name].exposed.players[data.player] = 0;

        // Set player stats
        socket.set('name', data.player);
        socket.set('game', data.name);
        socket.set('flipped', []);
        socket.set('checking', null);

        // Join broadcasts for the game room
        socket.join(data.name);

        // Return data
        socket.emit('game-info', games[data.name].exposed);
    });

    socket.on('flip-card', function (data) {
        socket.get('name', function (err, player) {
            socket.get('game', function (err, game) {
                var card_identity = getCard(game, data);

                socket.get('checking', function (err, checking) {
                    // There's already a flipped card, check if they match
                    if (checking !== null) {

                        if (checking.x === data.x && checking.y === data.y) {
                            // User's playing a dirty trick, just shut up
                            return;
                        }

                        if (card_identity === checking.identity) {
                            /* Card matches, so:
                             * 1. Get flipped cards
                             * 2. Add checked and newly checked to them
                             * 3. Save flipped cards
                             * 4. User gets a point
                             * 5. Send back the cards that should flip over
                             */
                            socket.get('flipped', function (err, flipped) {
                                flipped.push(
                                    [checking.x, checking.y],
                                    [data.x, data.y]
                                );

                                socket.set('flipped', flipped, function () {
                                    socket.set('checking', null, function () {
                                        // Player gets a point
                                        games[game].exposed.players[player]++;

                                        socket.broadcast.to(game).emit(player + " got a point!");

                                        // TODO: Flip back another player!

                                        // Tell the client what to flip
                                        socket.emit('card-flipped', {
                                            identity: card_identity,
                                            flipover: [
                                                // Don't flip the previously clicked card, it's already flipped
                                                // [checking.x, checking.y],
                                                [data.x, data.y]
                                            ]
                                        });
                                    });
                                });
                            });
                        }
                    } else {
                        // Store checking since user clicked a first one
                        socket.set('checking', {
                            identity: card_identity,
                            x: data.x,
                            y: data.y
                        }, function () {
                            socket.emit('card-flipped', {
                                identity: card_identity,
                                flipover: [
                                    [data.x, data.y]
                                ]
                            });
                        });
                    }
                });
            });
        });
    });
});
