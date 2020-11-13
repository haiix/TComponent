!function () {
  'use strict';

  var cdnBabelStandalone = 'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/6.26.0/babel.min.js';
  var cdnBabelPolyfill = 'https://cdnjs.cloudflare.com/ajax/libs/babel-polyfill/6.26.0/polyfill.min.js';

  var transformOptions = {presets: ['es2015', 'es2016', 'es2017']};

  function path_normalize(path) {
    var src = path.split('/'), dst = [], i = 0, val;
    while ((val = src[i++]) != null) {
      if (val === '' || val === '.') continue;
      if (val === '..') dst.pop();
      else dst.push(val);
    }
    return (path[0] === '/' ? '/' : './') + dst.join('/');
  }

  function path_dirname(path) {
    return path.slice(0, path.lastIndexOf('/'));
  }

  var cache = {};
  var currdir = path_dirname(location.pathname);
  function require(path) {
    path = path_normalize(currdir + '/' + path);
    if (!cache[path]) {
      var req = new XMLHttpRequest();
      req.open('GET', path, false);
      req.send();
      if (req.status !== 200) throw new Error('Load faled: ' + path);
      var prevdir = currdir;
      currdir = path_dirname(path);
      cache[path] = new Function('\'use strict\';var exports={};' + Babel.transform(req.responseText, transformOptions).code + ';return exports')();
      currdir = prevdir;
    }
    return cache[path];
  }

  function loadScript(url, callback) {
    var script = document.createElement('script');
    script.onload = function (event) {
      document.head.removeChild(script);
      callback();
    };
    script.onerror = function (event) {
      throw new Error('Load faild: ' + url);
    };
    script.src = url;
    document.head.appendChild(script);
  }

  loadScript(cdnBabelPolyfill, function () {
    loadScript(cdnBabelStandalone, function () {
      var scripts = document.querySelectorAll('script[type="module"]'), i = 0, script;
      window.require = require;
      while (script = scripts[i++]) {
        if (script.src) require(script.getAttribute('src'));
        else new Function(Babel.transform(script.text, transformOptions).code)();
      }
      delete window.require;
    });
  });
}();