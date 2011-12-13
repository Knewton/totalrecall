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

function sendGameInfo(socket, game, broadcast) {
    broadcast = broadcast || false;

    var exposed = games[game].exposed;
    exposed.name = exposed.name.replace(/^game_/, '');

    if (broadcast) {
        socket.broadcast.to(game).emit('game-info', exposed);
    } else {
        socket.emit('game-info', exposed);
    }
}

function playerIsVictorious(stats) {
    return stats.flipped.length === (games[stats.game].hidden.card_count / 2);
}

function handleVictory(socket, stats) {
    games[stats.game].exposed.state = {
        winner: stats.name,
        next_game: new Date((Math.floor(new Date().getTime() / 1000) + 30) * 1000).valueOf() / 1000
    }

    // Send victory game info to both winner and everyone else
    sendGameInfo(socket, stats.game, false);
    sendGameInfo(socket, stats.game, true);
    setTimeout(function() { startNewGame(stats.game); }, 30000);

    for (id in io.sockets.sockets) {
        if (io.sockets.sockets.hasOwnProperty(id)) {
            io.sockets.sockets[id].get('stats', function (err, stats) {
                if (stats !== null) {
                    stats.checking = null;
                    stats.flipped = [];
                    io.sockets.sockets[id].set('stats', stats);
                }
            });
        }
    }
}

function startNewGame(game) {
    games[game].exposed.state = {
        started: Math.round((new Date()).valueOf() / 1000)
    };

    // Reset scores to 0
    for (player in games[game].exposed.players) {
        if (games[game].exposed.players.hasOwnProperty(player)) {
            games[game].exposed.players[player] = 0;
        }
    }

    games[game].hidden.cards = generateCards(8, 12);

    var exposed = games[game].exposed;
    exposed.name = exposed.name.replace(/^game_/, '');
    io.sockets.in(game).emit('game-info', games[game].exposed);
}

app.use(app.router);
app.use(express.static(__dirname + '/public'));

app.listen(3000);

io.sockets.on('connection', function (socket) {

    socket.on('disconnect', function () {
        socket.get('stats', function (err, stats) {
            if (stats === null) {
                // User has not joined a game
                return;
            }

            socket.leave(stats.game);
            socket.broadcast.to(stats.game).emit('announcement', stats.name + " left the game.");

            var new_players = {};
            for (player_name in games[stats.game].exposed.players) {
                if (games[stats.game].exposed.players.hasOwnProperty(player_name) && player_name !== stats.name) {
                    new_players[player_name] = games[stats.game].exposed.players[player_name];
                }
            }

            games[stats.game].exposed.players = new_players;
        });
    });

    // Player entered the game.
    socket.on('enter-game', function (data) {
        data.name = 'game_' + data.name;

        // Setup game if it doesn't exist
        if (!games.hasOwnProperty(data.name)) {
            games[data.name] = {
                exposed: {
                    name: data.name,
                    players: {},
                    state: {
                        started: Math.round((new Date()).valueOf() / 1000)
                    }
                },
                hidden: {
                    cards: generateCards(8, 12),
                    card_count: 24
                }
            };
        } else {

            // Player name is taken. Just stop.
            if (data.player in games[data.name].exposed.players) {
                socket.emit('error', "Player name " + data.player + " is taken.");
                return;
            }

            socket.broadcast.to(data.name).emit('announcement', data.player + " joined the game!");
            sendGameInfo(socket, data.name, true);
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
        sendGameInfo(socket, data.name, false);
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

                        socket.broadcast.to(stats.game).emit('announcement', stats.name + " got a point!");
                        sendGameInfo(socket, stats.game, true);

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
                                /* Checking unlucky_stats for null is a workaround for a bug: if a user disconnects,
                                   they aren't removed from io.sockets.sockets. To fix it properly I need to somehow
                                   exclude them from candidates
                                */
                                if (unlucky_stats === null || unlucky_stats.flipped === null) {
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
                                [data.x, data.y, card_identity]
                            ],
                            add_point: true
                        });

                        // Check for player victory and let players know if it happened
                        if (playerIsVictorious(stats)) {
                            handleVictory(socket, stats);
                            socket.emit('announcement', "You won the game!");
                            socket.broadcast.to(stats.game).emit('announcement', stats.name + " won the game!");
                        }
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
                    socket.emit('card-flipped', {
                        flipover: [
                            [data.x, data.y, card_identity]
                        ],
                        add_point: false
                    });
                });
            }
        });
    });
});
