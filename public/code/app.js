const X = 200;
const Y = 200;
const PIXEL_SIZE = 2;
const STRIP_SIZE = 15;
const FOLD_LENGTH = 3;
const ID_LENGTH = 6;
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

var controls = Object.create(null);

// main layout:
//--------------------------------------------------------------------//
//                                #logo                               //
//  .paper[ #position-indicator,  #canvas,  #strip-width-indicator ]  //
//                                #toolbar                            //
//--------------------------------------------------------------------//

window.onload = function() {

  // #logo
  // .paper :
  var position_indicator = document.getElementById("position-indicator");
  var canvas = document.getElementById('the-canvas');
  var strip_width_indicator = document.getElementById("strip-width-indicator");

  window.dispatchEvent(new Event('resize'));
  // var pixel_size = 2;
  // if( window.innerWidth < (X * PIXEL_SIZE) ) {
  //
  // }
  //
  // canvas.width = X * pixel_size;
  // canvas.height = Y * pixel_size;

  position_indicator.innerHTML = 1 + "/" + FOLD_LENGTH;

  //initialize firebase
  var config = {
    apiKey: "AIzaSyCNygh6ULvyoqM9p6HXGi1--5Hl8_KsIXA",
    authDomain: "igor-exquisite-corpse.firebaseapp.com",
    databaseURL: "https://igor-exquisite-corpse.firebaseio.com",
    projectId: "igor-exquisite-corpse",
    storageBucket: "igor-exquisite-corpse.appspot.com",
    messagingSenderId: "559778331241"
  };
  firebase.initializeApp(config);

  var database = firebase.database();
  var image_base = database.ref('images');

  var context = canvas.getContext("2d");
  var previous = {id: window.location.pathname.substring(1), position: 1};
  var pixels = [];
  for (var y = 0; y < Y; y++) {
    for (var x = 0; x < X; x++) {
      pixels.push(0);
    }
  }

  //get parent image if it exists
  if (previous.id)
    image_base.child(previous.id).once('value', drawPrevious);

  function drawPrevious(data) {
    var pixel_data = b64decode(data.val().pixels);

    previous.position = data.val().position;
    var pos_text = ((previous.position + 1) + "/" + FOLD_LENGTH);
    position_indicator.innerHTML = pos_text;
    if ((previous.position + 1) == FOLD_LENGTH) {strip_width_indicator.innerHTML = "";}
    var strip_start = (X * Y) - (STRIP_SIZE * X);
    for(var i = 0; i < (X * STRIP_SIZE);i++)
      pixels[i] = pixel_data[strip_start + i];
    drawPixels(context, pixels);
  }

  canvas.addEventListener('redraw', () => {
      drawPixels(context, pixels);
  });
  drawPixels(context, pixels);

  var toolbar = document.getElementById("toolbar");
  for (var name in controls)
    toolbar.appendChild(controls[name](context, pixels, previous, image_base));

  toolbar.addEventListener('done_drawing', function(e) {
    // remove drawing tools and UI elements:
    tools = Object.create(null);
    document.getElementsByClassName("tool-buttons").remove();
    document.getElementById("done-button").remove();

    // if we reach fold_length we draw the whole image:
    if (e.detail.position == FOLD_LENGTH) { // > ??
        var pixels_y = (FOLD_LENGTH * Y - ((FOLD_LENGTH - 1) * STRIP_SIZE));
        var anchor = element("A", {id: "download-link"}, "DOWNLOAD");
        var download_button = element("tool-btn", {id: "download-button"});

        canvas.setAttribute("height", pixels_y * PIXEL_SIZE);
        canvas.classList.add('done-drawing');

        var anchor = element("A", {id: "download-link"}, "DOWNLOAD");
        var download_button = element("tool-btn", {id: "download-button"});
        download_button.appendChild(anchor);
        toolbar.appendChild(download_button);

        getFullImage(image_base, FOLD_LENGTH, e.detail.id).then(function(pixels) {
            drawPixels(context, pixels, {x: X, y: pixels_y });
            anchor.href = canvas.toDataURL("image/png").replace(/^data:image\/[^;]/, 'data:application/octet-stream');
            anchor.download = 'excorp_' + e.detail.id + '.png';
        });
    } else { // otherwise we return a sharable link
        var share_url = element("input", {id: "share-url", value: (window.location.hostname + '/' + e.detail.id)});
        var copy_button = element("tool-btn", {id: "copy-button"}, "COPY");
        copy_button.classList.add('text-btn');
        canvas.classList.add('done-drawing');
        toolbar.appendChild(share_url);
        toolbar.appendChild(copy_button);
        copy_button.addEventListener("click", function(){
            share_url.select();
            document.execCommand("Copy");
            copy_button.classList.add("copied");
            copy_button.innerHTML = "COPIED";
        });
        share_url.focus();
        share_url.select();
    }
  } , false);
}

function getFullImage(image_base, position, id) {
  if (position == 1) {
      return image_base.child(id).once('value').then(function(data){
          var pixel_data = b64decode(data.val().pixels);
          return pixel_data;
      });
  } else {
      return image_base.child(id).once('value').then(function(data){
          return getFullImage(image_base, position - 1, data.val().parent_id).then(function(parent_pixels){
              var pixel_data = b64decode(data.val().pixels);
              parent_pixels.splice(-STRIP_SIZE * X); // remove strip
              return parent_pixels.concat(pixel_data);
          });
      });
  }
}

function drawPixels(context, pixels, resolution = {x: X, y: Y}) {
  var c_width = context.canvas.width;
  var c_height = context.canvas.height;
  var pixel_width = c_width / resolution.x;
  var pixel_height = c_height / resolution.y;
  context.fillStyle = "#A6AAA2";
  context.fillRect(0,0,c_width,c_height);
  context.fillStyle = "#222420";
  for (var y = 0; y < resolution.y; y++) {
    for (var x = 0; x < resolution.x; x++) {
      if (pixels[(y * resolution.x)+x] == 1) {
        context.fillRect((x * pixel_width),(y * pixel_height),pixel_width, pixel_height);
      }
    }
  }
}

// ------------------------------------------------------ //
//    DRAWING TOOLS: ThickLine, Line, Erase & Dither      //
// ------------------------------------------------------ //

var tools = Object.create(null);

controls.tool = function(context, pixels, previous, image_base) {
  var selected = "ThickLine";
  var dither_style = 1;
  var styles = {
    1: '▤',
    2: '▧',
    3: '▩',
    4: '▥',
    5: '▦'
  }

  var line_button = element("tool-btn", {id: "line-button"}, "・");
  var thick_button = element("tool-btn", {id: "thick-button"}, "●");  thick_button.classList.add("selected");
  var dither_button = element("tool-btn", {id: "dither-button"}, styles[dither_style]);
  var erase_button = element("tool-btn", {id: "erase-button"}, "○");

  function selectTool(tool_button) {
      document.getElementsByClassName("selected")[0].classList.remove("selected");
      tool_button.classList.add("selected");
  }

  line_button.addEventListener("click", function(){ selectTool(line_button); selected = "Line";});
  thick_button.addEventListener("click", function(){ selectTool(thick_button); selected = "ThickLine";});
  dither_button.addEventListener("click", function(){
      selectTool(dither_button);
      if (selected == "Dither") {
          dither_style = (dither_style % 5) + 1;
          dither_button.innerHTML = styles[dither_style];
      }
      selected = "Dither";});
  erase_button.addEventListener("click", function(){selectTool(erase_button); selected = "Erase";});

  var select = element("div", {class: "tool-buttons"}, line_button, thick_button, dither_button, erase_button);

  context.canvas.addEventListener("touchmove", function(e) {
    tools[selected](event, context, pixels, dither_style);
    e.preventDefault();
  });

  context.canvas.addEventListener("mousedown", function(e) {
    if (e.which == 1) {
      tools[selected](e, context, pixels, dither_style);
      e.preventDefault();
    }
  });

  return select;
};

function pixelPos(e, element) {
  var rect = element.getBoundingClientRect();

  var pixel_size = element.width / X;

  if (e.type == "touchmove") {
    pos = {x: Math.floor(e.touches[0].clientX - rect.left),
          y: Math.floor(e.touches[0].clientY - rect.top)};
  } else {
    pos = {x: Math.floor(e.clientX - rect.left),
          y: Math.floor(e.clientY - rect.top)};
  }
  pos.x = Math.floor(pos.x / pixel_size);
  pos.y = Math.floor(pos.y / pixel_size);

  return pos;
}

function addPixel(pixels, pos, color) {
  if (pos.x >= 0 && pos.x < X && pos.y >= 0 && pos.y < Y)
    pixels[(pos.y * X) + pos.x] = color;
  return pixels;
}

function drawLine(pixels, start_pos, end_pos, color) {
    var x1 = start_pos.x;
    var y1 = start_pos.y;
    var x2 = end_pos.x;
    var y2 = end_pos.y;

    var dx = Math.abs(x2 -x1);
    var dy = Math.abs(y2 - y1);
    var sx = (x1 < x2) ? 1 : -1;
    var sy = (y1 < y2) ? 1 : -1;
    var err = dx - dy;

    // draw first pixel
    addPixel(pixels, start_pos, color);

    while (!((x1 == x2) && (y1 == y2))) {
        var e2 = err << 1;
        if (e2 > -dy) {
            err -= dy;
            x1 += sx;
        }
        if (e2 < dx) {
            err += dx;
            y1 += sy;
        }
        addPixel(pixels, {x: x1, y: y1}, color);
    }
}

function trackDrag(onMove) {
  function end(e) {
    removeEventListener("mousedown", onMove);
    removeEventListener("mousemove", onMove);
    removeEventListener("touchstart",onMove);
    removeEventListener("touchmove", onMove);
    removeEventListener("mouseup", end);
    removeEventListener("touchend", end);
  }
  addEventListener("mousedown", onMove);
  addEventListener("mousemove", onMove);
  addEventListener("touchstart", onMove);
  addEventListener("touchmove", onMove);
  addEventListener("mouseup", end);
  addEventListener("touchend", end);
}

tools.ThickLine = function(e, context, pixels, dither_style) {
  tools.Line(e, context, pixels, dither_style, color = 1, thickness = 2);
};

tools.Line = function(e, context, pixels, dither_style, color = 1, thick = 0) {
  var old_pos = pixelPos(e, context.canvas);
  trackDrag(function(e) {
    var pixel_pos = pixelPos(e, context.canvas);

	 thick == 0 ? scribbleNoise('thin') : scribbleNoise('thick');

    var t = thick;
    while (t > 0) {
      for (var brush_x = -t; brush_x <= t; brush_x++) {
        var brush_y = t - Math.abs(brush_x);
        drawLine(pixels, {x: old_pos.x + brush_x , y:old_pos.y + brush_y}, {x: pixel_pos.x + brush_x , y:pixel_pos.y + brush_y}, color);
        drawLine(pixels, {x: old_pos.x + brush_x , y:old_pos.y - brush_y}, {x: pixel_pos.x + brush_x , y:pixel_pos.y - brush_y}, color);
        pixels = addPixel(pixels,{x: pixel_pos.x + brush_x , y:pixel_pos.y + brush_y},color);
        pixels = addPixel(pixels,{x: pixel_pos.x + brush_x , y:pixel_pos.y - brush_y},color);
      }
      t = t - 1;
    }
    drawLine(pixels, old_pos, pixel_pos, color);
    pixels = addPixel(pixels,{x: pixel_pos.x, y:pixel_pos.y},color);
    drawPixels(context, pixels);
    old_pos = pixel_pos;
  });
};

tools.Erase = function(e, context, pixels, dither_style) {
  tools.Line(e, context, pixels, dither_style, color = 0, thickness = 4);
};

tools.Dither = function(e, context, pixels, dither_style, color = 1) {
  trackDrag(function(e) {
    var pixel_pos = pixelPos(e, context.canvas);
    var t = 5;

	 scribbleNoise('dither')

    for (var brush_x = -t; brush_x <= t; brush_x++) {
        for (var brush_y = -t; brush_y <= t; brush_y++) {
            pixel_x = pixel_pos.x + brush_x;
            pixel_y = pixel_pos.y + brush_y;
            switch ( dither_style ) {
              case 1:
                if ( (pixel_y % 4) == 0 ) { // horizontal lines 0.25
                  pixels = addPixel(pixels,{x: pixel_pos.x + brush_x , y:pixel_pos.y + brush_y},color);
                }
                break;
              case 2:
                if ( ((pixel_x - pixel_y) % 4) == 0 ) { // diagonal lines
                  pixels = addPixel(pixels,{x: pixel_pos.x + brush_x , y:pixel_pos.y + brush_y - 1},color);
                }
                break;
              case 3:
                if ( ((pixel_x + pixel_y) % 2) == 0 ) { // 0.5 dither
                  pixels = addPixel(pixels,{x: pixel_pos.x + brush_x , y:pixel_pos.y + brush_y},color);
                }
                break;
              case 4:
                if ( (pixel_x % 2) == 0 ) { // vertical lines 0.5
                  pixels = addPixel(pixels,{x: pixel_pos.x + brush_x , y:pixel_pos.y + brush_y},color);
                }
                break;
              case 5:
                if ( (pixel_x % 4) == 1 && (pixel_y % 4) == 2) { // dots 0.06
                  pixels = addPixel(pixels,{x: pixel_pos.x + brush_x , y:pixel_pos.y + brush_y},color);
                }
                break;
            }
        }
    }
    drawPixels(context, pixels);
  });
}

// DONE button
controls.save = function(context, pixels, previous, image_base) {
  var done_button = element("tool-btn", {id:"done-button"}, "DONE");
  done_button.classList.add('text-btn');
  function update() {
    var id = shortID();
    var new_pos = previous.position + 1;
    var done_event = new CustomEvent('done_drawing', {
        detail: {
          id: id,
          position: new_pos
        },
        bubbles: true,
        canclable: false
    });

    var pixels_b64 = b64encode(pixels);

    done_button.dispatchEvent(done_event);
    if (previous.id) {
      image_base.child(id).set({
        parent_id: previous.id,
        pixels: pixels_b64,
        position: previous.position + 1
      })
    } else {
      image_base.child(id).set({
        parent_id: '',
        pixels: pixels_b64,
        position: 1
      })
    }
  }
  done_button.addEventListener("click", update);
  return done_button;
};

// creates a html element
function element(name, attributes) {
  var node = document.createElement(name);
  if (attributes) {
    for (var attr in attributes)
      if (attributes.hasOwnProperty(attr))
        node.setAttribute(attr, attributes[attr]);
  }
  for (var i = 2; i < arguments.length; i++) {
    var child = arguments[i];
    if (typeof child == "string")
      child = document.createTextNode(child);
    node.appendChild(child);
  }
  return node;
}

// binary array to b64
function b64encode(pixel_data) {
  var pixels_b64 = btoa(
      pixel_data.join('')
      .match(/(.{8})/g)
      .map(function(x) {
        return String.fromCharCode(parseInt(x, 2));
      })
      .join('')
    );
    //compress
    var pixels_b64c = pixels_b64.replace(/AA/g, '!')
                        .replace(/!!/g, '@')
                        .replace(/@@/g, '#')
                        .replace(/###/g, '%')
                        .replace(/%%%%/g, '&')
                        .replace(/\/\//g, '*')
                        .replace(/\*\*/g, '(')
                        .replace(/\(\(/g, ')')
    return pixels_b64c;
}

// b64 string to binary array
function b64decode(pixels_b64c) {
  //decompress
  pixels_b64 = pixels_b64c.replace(/\)/g, '((')
                          .replace(/\(/g, '**')
                          .replace(/\*/g, '//')
                          .replace(/&/g, '%%%%')
                          .replace(/%/g, '###')
                          .replace(/#/g, '@@')
                          .replace(/@/g, '!!')
                          .replace(/!/g, 'AA')

  var pixel_data = atob(pixels_b64)  //convert from base64
      .split('')
      .map(function(x) {
        return ('0000000' + x.charCodeAt(0).toString(2)).substr(-8, 8);
      })
      .join('')   // "0101"
      .split('') // ["0","1","0","1"]
      .map(Number); // [0,1,0,1]
  return pixel_data;
}

// generates a short ID
function shortID() {
  var id = '';
  for (var i = 0; i < ID_LENGTH; i++) {
    id += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
  }
  return id;
}

//the following allows for removing of elements like so: document.getElementById("my-element").remove();
Element.prototype.remove = function() {
    this.parentElement.removeChild(this);
}
NodeList.prototype.remove = HTMLCollection.prototype.remove = function() {
    for(var i = this.length - 1; i >= 0; i--) {
        if(this[i] && this[i].parentElement) {
            this[i].parentElement.removeChild(this[i]);
        }
    }
}

window.addEventListener('resize', () => {
  var canvas = document.getElementById('the-canvas');
  var redraw_event = new CustomEvent('redraw');
  if (window.innerWidth < (X * PIXEL_SIZE)) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerWidth;
  } else {
    canvas.width = X * PIXEL_SIZE;
    canvas.height = Y * PIXEL_SIZE;
  }
  canvas.dispatchEvent(redraw_event);
});
