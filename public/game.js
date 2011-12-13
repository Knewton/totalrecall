/**
 * Memory fight
 *
 * Copyright (c) 2010 Knewton
 * Dual licensed under:
 *  MIT: http://www.opensource.org/licenses/mit-license.php
 *  GPLv3: http://www.opensource.org/licenses/gpl-3.0.html
 */
/*jslint browser: true, maxerr: 50, indent: 4, maxlen: 79 */
(function (KOI) {
    "use strict";

    //------------------------------
    //
    // Constants
    //
    //------------------------------

    //------------------------------
    // Board
    //------------------------------

        /**
         * The dimensions of the game board.
         * @type {Array<int>}
         */
    var DIMENSION = [6, 4],

    //------------------------------
    //
    // Properties
    //
    //------------------------------

        /**
         * The name of the current player.
         * @type {string}
         */
        current_player,

        /**
         * The socket connection.
         * @type {Socket}
         */
        socket = io.connect(window.location.toString()),

        /**
         * The player settings.
         * @type {Store}
         */
        storage = new Store("total-recall");
    
    //------------------------------
    //
    // Methods
    //
    //------------------------------

    //------------------------------
    // Board
    //------------------------------
    
    /**
     * Create the game board.
     * @param {number} cards The number of cards for the board.
     */
    function generateBoard() {
        var markup = [],
            x = 0,
            y = 0;
        while (true) {
            markup.push(
                KOI.format("a.card.koi-event[rel=flip]#x{}-y{}", x, y), [
                    "span.back", "span.front"
                ]
            );
            x += 1;
            if (x === DIMENSION[0]) {
                x = 0;
                y += 1;
            }
            if (y === DIMENSION[1]) {
                break;
            }
        }
        KOI.getElements("#cards").appendChild(KOI.markup(markup));
    }

    //------------------------------
    // Game
    //------------------------------

    /**
     * Enable the form.
     * @param {boolean} enable Disables the form if false.
     */
    function enableForm(enable) {
        var state = "";
        if (KOI.isValid(enable) && !Boolean(enable)) {
            state = "disabled";
        }
        KOI.each(KOI.getElements("form-field"), function (index, e) {
            e.setAttribute("disabled", state);
        });
    }

    /**
     * Joins a game.
     * @param {string} username The username to use.
     * @param {string} game The name of the game to join.
     * @param {boolean} remember Should this game be remembered? Default false.
     */
    function joinGame(username, game, remember) {
        current_player = username;
        enableForm(false);
        socket.emit("enter-game", {
            name: game,
            player: username
        });
        if (Boolean(remember)) {
            storage.set("username", username);
            storage.set("game", game);
        }
    }

    /**
     * Get the dimensions for the provided element.
     * @param {HTMLElement} e The element.
     */
    function getDimensions(e) {
        var d = e.id.split("-");
        return [parseInt(d[0].substr(1), 10), parseInt(d[1].substr(1), 10)];
    }

    /**
     * Flip a card.
     * @param {Array<int>} dim The dimensions.
     */
    function flipCard(dim) {
        socket.emit("flip-card", {
            x: dim[0],
            y: dim[1]
        });
    }

    /**
     * Flip a set of cards.
     * @param {Array<int>} cards The cards to flip.
     * @param {boolean} unflip Unflip the cards? Default false.
     */
    function flip(cards, unflip) {
        KOI.each(cards, function (index, card) {
            KOI.processors.classes(
                KOI.getElements(KOI.format("#x{}-y{}", card[0], card[1])), 
                unflip ? "" : KOI.format("flip card-{}", card[2]));
        });
    }

    //------------------------------
    //
    // Event bindings
    //
    //------------------------------

    //------------------------------
    // Join
    //------------------------------
    
    /**
     * Listen for the join form being submitted.
     * @param {Event} event The event object.
     */
    function joinSubmitHandler(event) {
        KOI.stopEvent(event);
        var username = KOI.getElements("#username").value,
            game = KOI.getElements("#game").value,
            theme = KOI.getElements("#theme").value;
        if (KOI.isEmpty(username)) {
            return alert("You must enter a username");
        }
        if (KOI.isEmpty(game)) {
            return alert("You must enter a game");
        }
        KOI.processors.classes(document.body, KOI.format("skin-{}", theme));
        joinGame(username, game, true);
    }

    //------------------------------
    // Game
    //------------------------------

    /**
     * Flip over a card.
     * @param {HTMLElement} The element being clicked.
     */
    KOI.bind("flip", function (e) {
        if (!KOI.hasClass(e, "flip")) {
            var dimensions = getDimensions(e);
            flipCard(dimensions);
        }
    });

    //------------------------------
    // Server communication
    //------------------------------

    /**
     * Get game info.
     * @param {Object} data The game info.
     */
    socket.on("game-info", function (data) {
        KOI.processors.text(KOI.getElements("#title"), 
            KOI.format("[{}] Total Recall", data.name));
        KOI.processors.classes(KOI.getElements("#join"), "hide");
        KOI.processors.classes(KOI.getElements("#cards"));
    });

    /**
     * Get the flip info.
     * @param {Object} data The game state.
     */
    socket.on("card-flipped", function (data) {
        flip(data.flipover);
        if (data.add_point) {
            // Update the current_player's points
        }
    });

    /**
     * Display an announcement from the server.
     * @param {string} data The announcement.
     */
    socket.on("announcement", function (data) {
        console.log(data);
    });

    /**
     * Get the flipback info.
     * @param {Object} data The flipback info.
     */
    socket.on("card-flipback", function (data) {
        if (KOI.isValid(data.flipover)) {
            flip(data.flipover);
            setTimeout(function () {
                flip(data.flipback, true);
            }, 500);
        } else {
            flip(data.flipback, true);
        }
    });

    //------------------------------
    // System
    //------------------------------

    /**
     * Setup the game.
     */
    KOI.bind("DOMReady", function () {
        generateBoard();
        KOI.processors.classes(KOI.getElements("#cards"), "hide");
        KOI.listen(KOI.getElements("#join"), "submit", joinSubmitHandler);
        KOI.processors.text(KOI.getElements("#title"), "Total Recall");
        KOI.getElements("#game").setAttribute("value", "Knewton");
        KOI.getElements("#username").focus();
    });

    //------------------------------
    //
    // Exposure
    //
    //------------------------------

}(window.KOI));

