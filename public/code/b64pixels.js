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
