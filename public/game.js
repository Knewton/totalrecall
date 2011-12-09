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
         * The socket connection.
         * @type {Socket}
         */
        socket = io.connect('http://localhost'),

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
    function generateBoard(cards) {
        var index = 0,
            markup = [];
        for (; index < cards; index++) {
            markup.push("div.card", [
                "a.front.koi-event[rel=flip]", 
                "span.back"
            ]);
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
            game = KOI.getElements("#game").value;
        if (KOI.isEmpty(username.value)) {
            return alert("You must enter a username");
        }
        if (KOI.isEmpty(game.value)) {
            return alert("You must enter a game");
        }
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
        KOI.processors.classes(e.parentElement, "flip");
    });

    //------------------------------
    // Server communication
    //------------------------------

    /**
     * Get game info.
     * @param {Object} The game info.
     */
    socket.on("game-info", function (data) {
        generateBoard(24);
        KOI.processors.text(KOI.getElements("#title"), data.name);
        KOI.processors.classes(KOI.getElements("#join"), "hide");
        KOI.processors.classes(KOI.getElements("#cards"));
    });

    //------------------------------
    // System
    //------------------------------

    /**
     * Setup the game.
     */
    KOI.bind("DOMReady", function () {
        KOI.processors.classes(KOI.getElements("#join"), "hide");
        KOI.processors.classes(KOI.getElements("#cards"), "hide");
        KOI.listen(KOI.getElements("#join"), "submit", joinSubmitHandler);

        var username = storage.get("username"),
            game = storage.get("game"),
            usernameField = KOI.getElements("#username");

        if (KOI.isValid(username)) {
            if (KOI.isValid(game)) {
                joinGame(username, game);
            } else {
                usernamefield.setAttribute("value", username);
            }
        } else {
            KOI.processors.text(KOI.getElements("#title"), "Total Recall");
            KOI.getElements("#game").setAttribute("value", "Knewton");
            usernameField.focus();
            KOI.processors.classes(KOI.getElements("#join"), "hide");
        }
    });

    //------------------------------
    //
    // Exposure
    //
    //------------------------------

}(window.KOI));

