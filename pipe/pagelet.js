/*globals Primus, ActiveXObject, CollectGarbage */
'use strict';

/**
 * Representation of a single pagelet.
 *
 * @constructor
 * @param {Pipe} pipe The pipe.
 * @api public
 */
function Pagelet(pipe, name, data) {
  Primus.EventEmitter.call(this);

  this.pipe = pipe;
}

//
// Inherit from Primus's EventEmitter.
//
Pagelet.prototype = new Primus.EventEmitter();
Pagelet.prototype.constructor = Pagelet;

/**
 * Configure the Pagelet.
 *
 * @param {String} name The given name of the pagelet.
 * @param {Object} data The data of the pagelet.
 * @api private
 */
Pagelet.prototype.configure = function configure(name, data) {
  this.name = name;
};

/**
 * Find the element based on the attribute and value.
 *
 * @returns {Array|NodeList}
 * @api private
 */
Pagelet.prototype.$ = function $(attribute, value) {
  if (document && 'querySelectorAll' in document) {
    return document.querySelectorAll('['+ attribute +'="'+ value +'"]');
  }

  //
  // No querySelectorAll support, so we're going to do a full DOM scan.
  //
  var all = document.getElementsByTagName('*')
    , length = all.length
    , results = []
    , i = 0;

  for (; i < length; i++) {
    if (all[i].getAttribute(attribute) === value) {
      results.push(all[i]);
    }
  }

  return results;
};

/**
 * Create a sandboxed container for the pagelet to run in.
 *
 * @param {String} code The client side code that needs to be sandboxed.
 * @api private
 */
Pagelet.prototype.sandbox = function sandbox(code) {
  var script = document.getElementsByTagName('script')[0]
    , unique = this.name + (+new Date())
    , container;

  if (!this.htmlfile) {
    try {
      //
      // Internet Explorer 6/7 require a unique name attribute in order to work.
      //
      container = document.createElement('<iframe name="'+ unique +'">');
    } catch (e) {
      container = document.createElement('iframe');
      container.name = unique;
    }

    //
    // The iframe needs to be added in to the DOM before we can modify it, make
    // sure it's remains unseen.
    //
    container.style.top = container.style.left = -10000;
    container.style.position = 'absolute';
    container.style.display = 'none';
    script.parentNode.insertBefore(this.container, script);

    this.container = container.contentDocument || container.contentWindow.document;
    this.container.open();
  } else {
    this.container = new ActiveXObject('htmlfile');
  }

  this.container.write('<html><s'+'cript>'+ code +'</s'+'cript></html>');
  this.container.close();
};

/**
 * Prepare the JavaScript code for iframe injection and sandboxing.
 *
 * @param {String} code The client side code of the pagelet.
 * @returns {String}
 * @api private
 */
Pagelet.prototype.prepare = function prepare(code) {
  return [
    //
    // Force the same domain as our "root" script.
    //
    'document.domain="'+ document.domain +'";',
    '(function (o, h) {',

    //
    // Eliminate the browsers blocking dialogs, we're in a iframe not a browser.
    //
    'for (var i = 0; i < h.length; i++) o[h[i]] = function () {};',

    //
    // The actual client-side code that needs to be evaluated.
    //
    code,

    '})(this, ["alert", "prompt", "confirm"]);'
  ].join('\n');
};

/**
 * Does this browser support HTMLfile's. It's build upon the ActiveXObject and
 * allows us to embed a page within a page without triggering any loading
 * indicators. The added benefit is that it doesn't need to be added to the DOM
 * in order for the page and it's resources to load.
 *
 * It's detected using feature detection.
 *
 * @type {Boolean}
 * @private
 */
Pagelet.prototype.htmlfile = false;

try { Pagelet.prototype.htmlfile = !!new ActiveXObject('htmlfile'); }
catch (e) {}

/**
 * Destroy the pagelet and clean up all references so it can be re-used again in
 * the future.
 *
 * @TODO remove unused CSS files
 * @api public
 */
Pagelet.prototype.destroy = function destroy() {
  //
  // Automatically schedule this Pagelet instance for re-use.
  //
  this.pipe.free(this);

  if (!this.htmlfile) {
    this.container.parentNode.removeChild(this.container);
    this.container = null;
    return;
  }

  //
  // We need to ensure that all references to the created HTMLFile sandbox are
  // removed before we call the `CollectGarbage` method of Internet Explorer or
  // it will not be cleaned up properly.
  //
  this.container = null;
  CollectGarbage();
};

//
// Expose the module.
//
module.exports = Pagelet;