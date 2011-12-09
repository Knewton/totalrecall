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
    //
    // Properties
    //
    //------------------------------

    //------------------------------
    //
    // Methods
    //
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
    //
    // Event bindings
    //
    //------------------------------

    KOI.bind("flip", function (e) {
        KOI.processors.classes(e.parentElement, "flip");
    });

    //------------------------------
    //
    // Exposure
    //
    //------------------------------

    KOI.bind("DOMReady", function () {
        generateBoard(24);
    });

}(window.KOI));

