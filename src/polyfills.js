// Polyfills for Samsung Tizen 5.5+ (Chrome 47-69)
// Full polyfills for maximum compatibility

require('core-js/stable');
require('regenerator-runtime/runtime');

// Additional polyfills for Tizen TV
if (typeof globalThis === 'undefined') {
  window.globalThis = window;
}

// Ensure Promise.allSettled exists (Chrome 69 doesn't have it)
if (!Promise.allSettled) {
  Promise.allSettled = function(promises) {
    return Promise.all(
      promises.map(function(promise) {
        return Promise.resolve(promise).then(
          function(value) {
            return { status: 'fulfilled', value: value };
          },
          function(reason) {
            return { status: 'rejected', reason: reason };
          }
        );
      })
    );
  };
}

// Ensure Array.prototype.flat exists (Chrome 69 has it, but being safe)
if (!Array.prototype.flat) {
  Array.prototype.flat = function(depth) {
    var flattend = [];
    depth = depth === undefined ? 1 : Math.floor(depth);
    (function flat(array, depth) {
      for (var i = 0; i < array.length; i++) {
        var el = array[i];
        if (Array.isArray(el) && depth > 0) {
          flat(el, depth - 1);
        } else {
          flattend.push(el);
        }
      }
    })(this, depth);
    return flattend;
  };
}

// Ensure Array.prototype.flatMap exists
if (!Array.prototype.flatMap) {
  Array.prototype.flatMap = function(callback, thisArg) {
    return this.map(callback, thisArg).flat(1);
  };
}

// Object.fromEntries polyfill (Chrome 69 doesn't have it)
if (!Object.fromEntries) {
  Object.fromEntries = function(entries) {
    var obj = {};
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      obj[entry[0]] = entry[1];
    }
    return obj;
  };
}

// String.prototype.matchAll polyfill (Chrome 69 doesn't have it)
if (!String.prototype.matchAll) {
  String.prototype.matchAll = function(regexp) {
    var matches = [];
    var match;
    var flags = regexp.flags || '';
    if (flags.indexOf('g') === -1) {
      regexp = new RegExp(regexp.source, flags + 'g');
    }
    while ((match = regexp.exec(this)) !== null) {
      matches.push(match);
    }
    return matches[Symbol.iterator] ? matches[Symbol.iterator]() : matches;
  };
}

console.log('[Polyfills] Loaded for Tizen TV compatibility');
