let PIXI = require('pixi.js');
if (!PIXI.utils.isWebGLSupported()) {
    //fallback option for browsers without webgl
    PIXI = require('pixi.js-legacy');
}
const Viewport = require('pixi-viewport');
const d3 = require('d3');

import './globals';

const z = 1;
const tileSize = Math.pow(2, 8 - z);
const res = 10000; //resolution
const origin = { x: 0, y: 0 };
const tileCache = {}; //store loaded tiles

//create application and add it to page
let app = new PIXI.Application({
    width: 1000,
    height: 500,
    antialias: true
});
document.body.appendChild(app.view);
app.renderer.backgroundColor = 0x333333;

// create viewport
const viewport = new Viewport.Viewport({
    screenWidth: 1000,
    screenHeight: 500,
    interaction: app.renderer.plugins.interaction
});

// add the viewport to the stage
app.stage.addChild(viewport);

// activate plugins
viewport
    .drag()
    .pinch()
    .wheel({ percent: 10.0, smooth: 5 }) //TODO make it two
    //.decelerate()
    ;

//value to color
const valueToColor = function (value) {
    if (value > 100000) return 0xff0000;
    if (value > 50000) return 0xff2222;
    if (value > 20000) return 0xff4444;
    if (value > 10000) return 0xff6666;
    if (value > 5000) return 0xff8888;
    if (value > 2000) return 0xffaaaa;
    if (value > 0) return 0xffcccc;
    return 0xffffff;
};

//create graphics layer for each tile
const drawTile = function (tile) {
    let gr = new PIXI.Graphics();
    for (var j = 0; j < tile.cells.length; j++) {
        var cell = tile.cells[j];
        //draw cell
        gr.x = origin.x + tile.x * tileSize * res;
        gr.y = origin.y + tile.y * tileSize * res;
        gr.y = -gr.y;
        //TODO fix that: gr.scale = res;
        gr.beginFill(valueToColor(cell.val));
        gr.drawRect(res * cell.x, -res * cell.y, res, res);
        //test drawRoundedRect ?
        gr.endFill();
    }
    viewport.addChild(gr);
};


/**
 *  Function which redraws the tiles according to the current visible bounds
 *
 * @param {*} clear - whether to clear the viewport or not
 */
const refresh = function (clear) {
    console.log(app);
    if (clear)
        viewport.removeChildren();

    var bounds = viewport.getVisibleBounds(),
        tileXMin = Math.floor((bounds.x - origin.x) / (res * tileSize)),
        tileXMax = Math.floor((bounds.x + bounds.width - origin.x) / (res * tileSize)) + 1,
        tileYMin = Math.floor((-bounds.y - origin.y) / (res * tileSize)),
        tileYMax = Math.floor((-bounds.y + bounds.height - origin.y) / (res * tileSize)) + 1
        ;

    //TODO check the y !
    //console.log(tileXMin, tileXMax, tileYMin, tileYMax)

    for (var x = tileXMin; x <= tileXMax; x++)
        for (var y = tileYMin; y <= tileYMax; y++) {
            //check if tile exists in cache
            var tile = tileCache[x + "_" + y + "_" + z];
            if (tile) {
                drawTile(tile);
                continue;
            }
            (function (x, y, z) {
                var testCSV = "https://raw.githubusercontent.com/eurostat/EuroGridLayer/master/PixiJS/tests/csvTiles/assets/csv/tiles/pop_grid_2011_10km/" + z + "/" + x + "/" + y + ".csv";

                //try to use that instead:
                //PIXI.loader
                //    .add("images/cat.png")
                //    .load(setup);

                d3.csv(testCSV, data => {
                    data = parseCSV(data);
                    //build
                    var tile = { x: x, y: y, cells: [] };
                    for (var i = 1; i < data.length; i++) {
                        var line = data[i];
                        tile.cells.push({ x: line[0], y: line[1], val: line[2] });
                    }
                    //store tile in cache
                    tileCache[x + "_" + y + "_" + z] = tile;
                    //draw tile
                    drawTile(tile);
                });
            })(x, y, z);
        }
};

viewport.on("wheel", e => {
    //console.log(e);
    refresh();
});

viewport.on("moved-end", e => {
    //console.log(e);
    refresh();
});

viewport.on("clicked", e => {
    //console.log(e);
    console.log(tileCache);
    refresh();
});

// parseCSV and convert to array
const parseCSV = (str) => {
    var arr = [];
    var quote = false; // true means we're inside a quoted field

    // iterate over each character, keep track of current row and column (of the returned array)
    for (var row = 0, col = 0, c = 0; c < str.length; c++) {
        var cc = str[c],
            nc = str[c + 1]; // current character, next character
        arr[row] = arr[row] || []; // create a new row if necessary
        arr[row][col] = arr[row][col] || ""; // create a new column (start with empty string) if necessary

        // If the current character is a quotation mark, and we're inside a
        // quoted field, and the next character is also a quotation mark,
        // add a quotation mark to the current column and skip the next character
        if (cc == '"' && quote && nc == '"') {
            arr[row][col] += cc;
            ++c;
            continue;
        }

        // If it's just one quotation mark, begin/end quoted field
        if (cc == '"') {
            quote = !quote;
            continue;
        }

        // If it's a comma and we're not in a quoted field, move on to the next column
        if (cc == "," || (cc == ";" && !quote)) {
            ++col;
            continue;
        }

        // If it's a newline (CRLF) and we're not in a quoted field, skip the next character
        // and move on to the next row and move to column 0 of that new row
        if (cc == "\r" && nc == "\n" && !quote) {
            ++row;
            col = 0;
            ++c;
            continue;
        }

        // If it's a newline (LF or CR) and we're not in a quoted field,
        // move on to the next row and move to column 0 of that new row
        if (cc == "\n" && !quote) {
            ++row;
            col = 0;
            continue;
        }
        if (cc == "\r" && !quote) {
            ++row;
            col = 0;
            continue;
        }

        // Otherwise, append the current character to the current column
        arr[row][col] += cc;
    }
    return arr;
};