function inet_ntoa(num) {
  var nbuffer = new ArrayBuffer(4);
  var ndv = new DataView(nbuffer);
  ndv.setUint32(0, num);

  var a = new Array();
  for(var i = 0; i < 4; i++){
      a[i] = ndv.getUint8(i);
  }
  return a.join('.');
}

module.exports = inet_ntoa
