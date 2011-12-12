    // Requires
var express = require('express'),
    app = express.createServer(),

    io = require('socket.io').listen(app),

    // Data
    games = {};

/**
 * Returns a two-dimensional array of cards to start off a game.
 *
 * Currently assumes that there are always four rows. Bad things could happen if
 * that isn't the case.
 */
function generateCards(types, pairs) {
    var contents = [],
        adding_pair,
        result = [],
        i = 0,
        x = (pairs * 2 / 4) - 1,
        y = 4 - 1;

    for (i = 0; i < pairs; i++) {
        adding_pair = Math.floor(Math.random() * (types - 0) + 0);
        contents.push(adding_pair, adding_pair);
    }

    contents.sort(function(a, b) {return 0.5 - Math.random();});

    for (i = 0; i <= x; i++) {
        result.push([]);
    }

    i = 0;
    while (x >= 0) {
        y = 4 - 1;
        while (y >= 0) {
            result[x].push(contents[i]);
            i++;
            y--;
        }
        x--;
    }

    return result;
}

function getCard(game, coords) {
    return games[game].hidden.cards[coords.x][coords.y];
}

app.use(app.router);
app.use(express.static(__dirname + '/public'));

app.listen(3000);

io.sockets.on('connection', function (socket) {
/*
    socket.on('disconnect', function () {
        socket.get('name', function (err, player) {
            socket.get('game', function (err, game) {
                socket.leave(game);
                socket.broadcast.to(game).emit(player + " left the game.");

                var new_players = {};
                for (player_name in games[game].exposed.players) {
                    if (games[game].exposed.players.hasOwnProperty(player_name) && player_name !== player) {
                        new_players[player_name] = games[game].exposed.players[player_name];
                    }
                }

                games[game].exposed.players = new_players;
            });
        });
    });
*/
    // Player entered the game.
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
                    cards: generateCards(8, 12),
                    card_count: 24
                }
            };
        }

        // Player name is taken. Just stop.
        if (data.player in games[data.name].exposed.players) {
            socket.emit('error', "Player name " + player + " is taken.");
            return;
        }

        games[data.name].exposed.players[data.player] = 0;

        // Set player stats
        socket.set('stats', {
            name: data.player,
            game: data.name,
            flipped: [],
            checking: null
        });

        // Join broadcasts for the game room
        socket.join(data.name);

        // Return data
        var exposed = games[data.name].exposed;
        exposed.name = exposed.name.replace(/^game_/, '');
        socket.emit('game-info', exposed);
    });

    // Player flips a card.
    socket.on('flip-card', function (data) {
        socket.get('stats', function (err, stats) {
            var card_identity = getCard(stats.game, data),
                checking = stats.checking;

            // There's already a flipped card, check if they match
            if (stats.checking !== null) {

                if (stats.checking.x === data.x && stats.checking.y === data.y) {
                    socket.emit("error", "You're already looking at that!");
                    return;
                }

                if (card_identity === stats.checking.identity) {
                    /* Card matches, so:
                     * 1. Get flipped cards
                     * 2. Add checked and newly checked to them
                     * 3. Save flipped cards
                     * 4. User gets a point
                     * 5. Send back the cards that should flip over
                     */
                    stats.flipped.push([
                        [stats.checking.x, stats.checking.y],
                        [data.x, data.y]
                    ]);

                    stats.checking = null;

                    socket.set('stats', stats, function () {
                        // Player gets a point
                        games[stats.game].exposed.players[stats.name]++;

                        socket.broadcast.to(stats.game).emit(stats.name + " got a point!");

                        // Evil code: pick a random other player and a random flipped pair
                        var candidates = [],
                            unlucky_sod = socket.id,
                            unlucky_sod_socket,
                            id;

                        for (id in io.sockets.sockets) {
                            if (io.sockets.sockets.hasOwnProperty(id) && id !== socket.id) {
                                candidates.push(id);
                            }
                        }

                        if (candidates.length) {
                            unlucky_sod = candidates[Math.ceil(Math.random() * candidates.length - 1)];
                            unlucky_sod_socket = io.sockets.sockets[unlucky_sod];
                            unlucky_sod_socket.get('stats', function (err, unlucky_stats) {
                                if (unlucky_stats.flipped === null) {
                                    return;
                                }

                                var flipback = Math.ceil(Math.random() * unlucky_stats.flipped.length - 1),
                                    flipped_back_pair = unlucky_stats.flipped[flipback],
                                    new_flipback = [];

                                unlucky_stats.flipped.forEach(function (v, i) {
                                    if (i !== flipback) {
                                        new_flipback.push(v);
                                    }
                                });

                                unlucky_stats.flipped = new_flipback;

                                unlucky_sod_socket.set('stats', unlucky_stats, function () {
                                    unlucky_sod_socket.emit('card-flipback', {flipback: flipped_back_pair});
                                });
                            });
                        }

                        // Tell the client what to flip
                        socket.emit('card-flipped', {
                            flipover: [
                                // Don't flip the previously clicked card, it's already flipped
                                // [checking.x, checking.y],
                                [data.x, data.y, card_identity]
                            ]
                        });
                    });
                        
                } else {
                    stats.checking = null;

                    // Player failed to match. Flip back!
                    socket.set('stats', stats, function () {
                        socket.emit("card-flipback", {
                            flipover: [
                                [data.x, data.y, card_identity]
                            ],
                            flipback: [
                                [data.x, data.y],
                                [checking.x, checking.y]
                            ]
                        });
                    });
                }
            } else {
                // Store checking since user clicked a first one
                stats.checking = {
                    identity: card_identity,
                    x: data.x,
                    y: data.y
                };

                socket.set('stats', stats, function () {
                    socket.emit('card-flipped', {flipover: [
                        [data.x, data.y, card_identity]
                    ]});
                });
            }
        });
    });
});
