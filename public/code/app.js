const X = 200;
const Y = 200;
const PIXEL_SIZE = 2;
const STRIP_SIZE = 15;
const FOLD_LENGTH = 3;
const ID_LENGTH = 6;
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

const controls = Object.create(null);

// main layout:
//--------------------------------------------------------------------//
//                                #logo                               //
//  .paper[ #position-indicator,  #canvas,  #strip-width-indicator ]  //
//                                #toolbar                            //
//--------------------------------------------------------------------//

window.onload = function() {
	//initialize firebase
   const config = {
     apiKey: "AIzaSyCNygh6ULvyoqM9p6HXGi1--5Hl8_KsIXA",
     authDomain: "igor-exquisite-corpse.firebaseapp.com",
     databaseURL: "https://igor-exquisite-corpse.firebaseio.com",
     projectId: "igor-exquisite-corpse",
     storageBucket: "igor-exquisite-corpse.appspot.com",
     messagingSenderId: "559778331241"
   };
   firebase.initializeApp(config);
	const database = firebase.database();
   const image_base = database.ref('images');

  // #logo
  // .paper :
  const position_indicator = document.getElementById("position-indicator");
  const canvas = document.getElementById('the-canvas');
  const strip_width_indicator = document.getElementById("strip-width-indicator");

  window.dispatchEvent(new Event('resize'));

  position_indicator.innerHTML = `1/${FOLD_LENGTH}`;

  const context = canvas.getContext("2d");
  const previous = {id: window.location.pathname.substring(1), position: 1};
  const pixels = [];
  for (let y = 0; y < Y; y++) {
    for (let x = 0; x < X; x++) {
      pixels.push(0);
    }
  }

  //get parent image if it exists
  if (previous.id) {
    image_base.child(previous.id).once('value', drawPrevious);
  }

  function drawPrevious(data) {
    const pixel_data = b64decode(data.val().pixels);

    previous.position = data.val().position;
    const pos_text = `${previous.position + 1}/${FOLD_LENGTH}`;
    position_indicator.innerHTML = pos_text;
    if ((previous.position + 1) == FOLD_LENGTH) {strip_width_indicator.innerHTML = "";}
    const strip_start = (X * Y) - (STRIP_SIZE * X);
    for( let i = 0; i < (X * STRIP_SIZE); i++ )
      pixels[i] = pixel_data[strip_start + i];
    drawPixels(context, pixels);
  }

	canvas.addEventListener('redraw', () => {
	    drawPixels(context, pixels);
	});
	drawPixels(context, pixels);

  const toolbar = document.getElementById("toolbar");
  for (let name in controls) {
    toolbar.appendChild(controls[name](context, pixels, previous, image_base));
 	}

  toolbar.addEventListener('done_drawing', function(e) {
    // remove drawing tools and UI elements:
    tools = Object.create(null);
    document.getElementsByClassName("tool-buttons").remove();
    document.getElementById("done-button").remove();

    // if we reach fold_length we draw the whole image:
    if (e.detail.position == FOLD_LENGTH) { // > ??
        const pixels_y = (FOLD_LENGTH * Y - ((FOLD_LENGTH - 1) * STRIP_SIZE));
        const anchor = element("A", {id: "download-link"}, "DOWNLOAD");
        const download_button = element("tool-btn", {id: "download-button"});
		  const paper = document.getElementById("paper");

        canvas.setAttribute("height", pixels_y); //before: * PIXEL_SIZE
		  canvas.setAttribute("width", X);
        canvas.classList.add('done-drawing');

		  //TODO: don't show download button on iOS
        download_button.appendChild(anchor);
        toolbar.appendChild(download_button);

        getFullImage(image_base, FOLD_LENGTH, e.detail.id).then(function(pixels) {
            drawPixels(context, pixels, {x: X, y: pixels_y });
            anchor.href = canvas.toDataURL("image/png").replace(/^data:image\/[^;]/, 'data:application/octet-stream');
				const image = element("IMG", {src: canvas.toDataURL("image/png")});
				canvas.remove();
				paper.appendChild(image);
            anchor.download = 'excorp_' + e.detail.id + '.png';
        });
    } else { // otherwise we return a sharable link
        const share_url = element("input", {id: "share-url", value: (window.location.hostname + '/' + e.detail.id)});
        const copy_button = element("tool-btn", {id: "copy-button"}, "COPY");
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
          const pixel_data = b64decode(data.val().pixels);
          return pixel_data;
      });
  } else {
      return image_base.child(id).once('value').then(function(data){
          return getFullImage(image_base, position - 1, data.val().parent_id).then(function(parent_pixels){
              const pixel_data = b64decode(data.val().pixels);
              parent_pixels.splice(-STRIP_SIZE * X); // remove strip
              return parent_pixels.concat(pixel_data);
          });
      });
  }
}

function drawPixels(context, pixels, resolution = {x: X, y: Y}) {
  const c_width = context.canvas.width;
  const c_height = context.canvas.height;
  const pixel_width = c_width / resolution.x;
  const pixel_height = c_height / resolution.y;
  context.fillStyle = '#A6AAA2';
  context.fillRect(0,0,c_width,c_height);
  context.fillStyle = "#222420";
  for (let y = 0; y < resolution.y; y++) {
    for (let x = 0; x < resolution.x; x++) {
      if (pixels[(y * resolution.x)+x] == 1) {
        context.fillRect((x * pixel_width),(y * pixel_height),pixel_width, pixel_height);
      }
    }
  }
}

// ------------------------------------------------------ //
//    DRAWING TOOLS: ThickLine, Line, Erase & Dither      //
// ------------------------------------------------------ //

const tools = Object.create(null);

controls.tool = function(context, pixels, previous, image_base) {
  let selected = "ThickLine";
  let dither_style = 1;
  const styles = {
    1: '▤',
    2: '▧',
    3: '▩',
    4: '▥',
    5: '▦'
  }

  const line_button = element("tool-btn", {id: "line-button"}, "・");
  const thick_button = element("tool-btn", {id: "thick-button"}, "●");  thick_button.classList.add("selected");
  const dither_button = element("tool-btn", {id: "dither-button"}, styles[dither_style]);
  const erase_button = element("tool-btn", {id: "erase-button"}, "○");

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

  const select = element("div", {class: "tool-buttons"}, line_button, thick_button, dither_button, erase_button);

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
  const rect = element.getBoundingClientRect();
  const pixel_size = element.width / X;

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
    let x1 = start_pos.x;
    let y1 = start_pos.y;
    const x2 = end_pos.x;
    const y2 = end_pos.y;

    const dx = Math.abs(x2 -x1);
    const dy = Math.abs(y2 - y1);
    const sx = (x1 < x2) ? 1 : -1;
    const sy = (y1 < y2) ? 1 : -1;
    let err = dx - dy;

    // draw first pixel
    addPixel(pixels, start_pos, color);

    while (!((x1 == x2) && (y1 == y2))) {
        const e2 = err << 1;
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
  let old_pos = pixelPos(e, context.canvas);
  trackDrag(function(e) {
    const pixel_pos = pixelPos(e, context.canvas);

	 thick == 0 ? scribbleNoise('thin') : scribbleNoise('thick');

    let t = thick;
    while (t > 0) {
      for (let brush_x = -t; brush_x <= t; brush_x++) {
        const brush_y = t - Math.abs(brush_x);
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
    const pixel_pos = pixelPos(e, context.canvas);
    const t = 5;

	 scribbleNoise('dither')

    for (let brush_x = -t; brush_x <= t; brush_x++) {
        for (let brush_y = -t; brush_y <= t; brush_y++) {
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
  const done_button = element("tool-btn", {id:"done-button"}, "DONE");
  done_button.classList.add('text-btn');
  function update() {
    const id = shortID();
    const new_pos = previous.position + 1;
    const done_event = new CustomEvent('done_drawing', {
        detail: {
          id: id,
          position: new_pos
        },
        bubbles: true,
        canclable: false
    });

    const pixels_b64 = b64encode(pixels);

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

window.addEventListener('resize', () => {
  const canvas = document.getElementById('the-canvas');

  const redraw_event = new CustomEvent('redraw');

  if (window.innerWidth < (X * PIXEL_SIZE)) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerWidth;
  } else {
    canvas.width = X * PIXEL_SIZE;
    canvas.height = Y * PIXEL_SIZE;
  }
  canvas.dispatchEvent(redraw_event);
});
