// ==UserScript==
// @name         Aliexpress Plus
// @namespace    http://www.facebook.com/Tophness
// @version      3.0.4
// @description  Sorts search results by item price properly with shipping costs included, enhances item pages
// @author       Tophness
// @match        https://*.aliexpress.com/w/wholesale*
// @match        https://*.aliexpress.com/wholesale*
// @match        https://*.aliexpress.com/category*
// @match        https://*.aliexpress.com/af/*
// @match        https://*.aliexpress.com/item/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/tinysort/2.3.6/tinysort.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/tinysort/2.3.6/tinysort.charorder.min.js
// @require      https://openuserjs.org/src/libs/sizzle/GM_config.min.js
// @updateURL    https://openuserjs.org/meta/Tophness/Aliexpress_Plus.meta.js
// @downloadURL  https://openuserjs.org/install/Tophness/Aliexpress_Plus.user.js
// @copyright    2014, Tophness (https://openuserjs.org/users/Tophness)
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connet       self
// @connet       *.aliexpress.com
// @license      MIT
// @run-at       document-idle
// ==/UserScript==

var sortingnow = false;
var tnum = 0;
var itemstype = 2;

var GM_SuperValue = new function () {

    var JSON_MarkerStr = 'json_val: ';
    var FunctionMarker = 'function_code: ';

    function ReportError (msg) {
        if (console && console.error){
            console.log (msg);
        }
        else{
            throw new Error (msg);
        }
    }

    if (typeof GM_setValue != "function"){
        ReportError ('This library requires Greasemonkey! GM_setValue is missing.');
    }
    if (typeof GM_getValue != "function"){
        ReportError ('This library requires Greasemonkey! GM_getValue is missing.');
    }

    this.set = function (varName, varValue) {

        if ( ! varName) {
            ReportError ('Illegal varName sent to GM_SuperValue.set().');
            return;
        }
        if (/[^\w _-]/.test (varName) ) {
            ReportError ('Suspect, probably illegal, varName sent to GM_SuperValue.set().');
        }

        switch (typeof varValue) {
            case 'undefined':
                ReportError ('Illegal varValue sent to GM_SuperValue.set().');
                break;
            case 'boolean':
            case 'string':
                GM_setValue (varName, varValue);
                break;
            case 'number':
                if (varValue === parseInt (varValue) && Math.abs(varValue) < 2147483647)
                {
                    GM_setValue (varName, varValue);
                    break;
                }
                break;
            case 'object':
                var safeStr = JSON_MarkerStr + JSON.stringify(varValue);
                GM_setValue (varName, safeStr);
                break;
            case 'function':
                var safeStr2 = FunctionMarker + varValue.toString();
                GM_setValue (varName, safeStr);
                break;

            default:
                ReportError ('Unknown type in GM_SuperValue.set()!');
                break;
        }
    }

    this.get = function (varName, defaultValue) {

        if ( ! varName) {
            ReportError ('Illegal varName sent to GM_SuperValue.get().');
            return;
        }
        if (/[^\w _-]/.test (varName) ) {
            ReportError ('Suspect, probably illegal, varName sent to GM_SuperValue.get().');
        }

        var varValue = GM_getValue(varName);
        if (!varValue){
            return defaultValue;
        }

        if (typeof varValue == "string") {
            //--- Is it a JSON value?
            let regxp = new RegExp ('^' + JSON_MarkerStr + '(.+)$');
            var m = varValue.match (regxp);
            if(m && m.length > 1) {
                varValue = JSON.parse ( m[1] );
                return varValue;
            }

            let regxp2 = new RegExp ('^' + FunctionMarker + '((?:.|\n|\r)+)$');
            let m2 = varValue.match (regxp2);
            if (m2 && m2.length > 1) {
                varValue = eval('(' + m2[1] + ')');
                return varValue;
            }
        }

        return varValue;
    }
};

GM_config.init(
    {
        'id': 'Config',
        title: 'Configure',
        'fields': {
            'sortmethod': {
                label: 'Search: Sort Mode',
                type: 'select',
                options: ['Cheapest Unit Price','Cheapest Total Price','Cheapest Total Price (Max Price)','Cheapest Price','Max Price'],
                default: 'Cheapest Total Price'
            },
            'pagesearch': {
                label: 'Search: Open pages and scrape shipping details if missing from search',
                type: 'checkbox',
                default: true
            },
            'UseSideImgs': {
                label: 'Wishlist: Search Listing Images (On The Left Side Previews)',
                type: 'checkbox',
                default: true
            },
            'UseInnerHTMLImgs': {
                label: 'Wishlist: Search Listing Property Images (Different Colors etc.)',
                type: 'checkbox',
                default: true
            },
            'UseB64Imgs': {
                label: 'Wishlist: Store Listing Images Locally',
                type: 'checkbox',
                default: true
            },
            'useTextSearch': {
                label: 'Wishlist: Search Listing Text',
                type: 'checkbox',
                default: true
            },
            'mode': {
                label: 'Wishlist: Listing Text Search Mode',
                type: 'select',
                options: [ 'Exact', 'Contains Text', 'Relative' ],
                default: 'Relative'
            },
            'similarity': {
                label: 'Wishlist: Listing Text Search Similarity',
                type: 'float',
                default: 0.8
            },
            'filterNamesFromImgs': {
                label: 'Wishlist: Remove Results Found In Text Search From Image Search',
                type: 'checkbox',
                default: true
            }
        }
    }
);
var orders = GM_SuperValue.get('wishdata', []);
var filterNamesFromImgs = GM_config.get('filterNamesFromImgs');
var UseB64Imgs = GM_config.get('UseB64Imgs');
var UseSideImgs = GM_config.get('UseB64Imgs');
var UseInnerHTMLImgs = GM_config.get('UseInnerHTMLImgs');
var useTextSearch = GM_config.get('useTextSearch');
var mode = GM_config.get('mode');
var similarityratio = GM_config.get('similarity');
var sortmethod = GM_config.fields.sortmethod.settings.options.indexOf(GM_config.get('sortmethod'))+1;
var pagesearch = GM_config.get('pagesearch');

GM_addStyle(".tabs{overflow:hidden;clear:both;} .tabs ul{list-style-type:none;bottom: -1px;position:relative;} .tabs li{float:left;} .tablist span{cursor: pointer;display:block;padding:5px 10px;text-decoration: none;margin: 0 4px;border-top:1px solid #CCC;border-left:1px solid #DDD;border-right:1px solid #DDD;font:13px/18px verdana,arial,sans-serif;border-bottom:1px solid #CCC;} .tablist span.exact{background-color: red;color: #fff;} .tablist span.containstext{background-color: blue;color: #fff;} .tablist span.relative{background-color: green;color: #fff;} .tablist span.images{background-color: yellow;color: #000;} .tablist span.active{background-color: #eee;color: #000;border-bottom:1px solid #fff;}");

!function(t,e){"object"==typeof exports&&"object"==typeof module?module.exports=e():"function"==typeof define&&define.amd?define([],e):"object"==typeof exports?exports.Rembrandt=e():t.Rembrandt=e()}(this,function(){return function(t){function e(i){if(n[i])return n[i].exports;var r=n[i]={exports:{},id:i,loaded:!1};return t[i].call(r.exports,r,r.exports,e),r.loaded=!0,r.exports}var n={};return e.m=t,e.c=n,e.p="",e(0)}([function(t,e,n){(function(e){"use strict";function i(t){return t&&t.__esModule?t:{"default":t}}function r(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}var o=function(){function t(t,e){for(var n=0;n<e.length;n++){var i=e[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(t,i.key,i)}}return function(e,n,i){return n&&t(e.prototype,n),i&&t(e,i),e}}(),a=n(1),u=(i(a),n(2)),s=i(u),c=n(3),f=i(c),l=n(4),h=i(l),d=n(5),m=i(d),p=n(6),g=i(p),v=n(7),_=i(v);e.Buffer=function(){};var y=function(){function t(e){r(this,t),this._imageA=null,this._imageB=null,this._options=s["default"].defaults(e,{imageA:null,imageB:null,thresholdType:t.THRESHOLD_PERCENT,maxThreshold:.01,maxDelta:20,renderComposition:!1,compositionMaskColor:g["default"].RED,maxOffset:0}),this._validateOptions()}return o(t,[{key:"compare",value:function(){var t=this;return this._loadImages().then(function(){var e=new _["default"](t._imageA,t._imageB,t._options);return e.compare()})}},{key:"_validateOptions",value:function(){var e=this,n=function(t){var n=e._options[t];if(!("string"==typeof n||Buffer.isBuffer(n)||n instanceof m["default"]))throw new Error("Option `"+t+"` must either be a String, Buffer or Rembrandt.Image.")};n("imageA"),n("imageB");var i=this._options,r=i.thresholdType,o=i.threshold,a=i.maxDelta,u=[t.THRESHOLD_PERCENT,t.THRESHOLD_PIXELS];if(u.indexOf(r)===-1)throw new Error("`thresholdType` must be either Rembrandt.THRESHOLD_PERCENT or Rembrandt.THRESHOLD_PIXELS");if(r===t.THRESHOLD_PERCENT&&o<0||o>1)throw new Error("`threshold` must be between 0 and 1");if(a<0||a>255)throw new Error("`maxDelta` must be between 0 and 255")}},{key:"_loadImages",value:function(){var t=this;return this._loadImage(this._options.imageA).then(function(e){return t._imageA=e,t._loadImage(t._options.imageB)}).then(function(e){t._imageB=e})}},{key:"_loadImage",value:function(t){return new f["default"](function(e,n){return t instanceof m["default"]?e(t):t instanceof Buffer?e(m["default"].fromBuffer(t)):void!function(){var n=s["default"].createImage();n.addEventListener("load",function(){e(m["default"].fromImage(n))}),n.crossOrigin="Anonymous",n.src=t}()})}}],[{key:"createImage",value:function(t,e){return new m["default"](t,e)}}]),t}();y.Image=m["default"],y.Color=g["default"],y.version=n(9).version;for(var b in h["default"])y[b]=h["default"][b];t.exports=y}).call(e,function(){return this}())},function(t,e){"use strict"},function(t,e,n){"use strict";function i(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}Object.defineProperty(e,"__esModule",{value:!0});var r=function(){function t(t,e){for(var n=0;n<e.length;n++){var i=e[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(t,i.key,i)}}return function(e,n,i){return n&&t(e.prototype,n),i&&t(e,i),e}}(),o=function(){function t(){i(this,t)}return r(t,null,[{key:"defaults",value:function(t){var e={};for(var n in t)e[n]=t[n];for(var i=arguments.length,r=Array(i>1?i-1:0),o=1;o<i;o++)r[o-1]=arguments[o];for(var a=0;a<r.length;a++){var u=r[a];for(var s in u)"undefined"==typeof e[s]&&(e[s]=u[s])}return e}},{key:"createCanvas",value:function(t,e){var n=void 0;return n=document.createElement("canvas"),n.width=t,n.height=e,n}},{key:"createImage",value:function(){var t=void 0;return t=new window.Image}}]),t}();e["default"]=o},function(t,e,n){var i;(function(r){"use strict";var o="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t};
!function(r,o,a){o[r]=o[r]||a(),"undefined"!=typeof t&&t.exports?t.exports=o[r]:(i=function(){return o[r]}.call(e,n,e,t),!(void 0!==i&&(t.exports=i)))}("Promise","undefined"!=typeof r?r:void 0,function(){function t(t,e){d.add(t,e),h||(h=p(d.drain))}function e(t){var e,n="undefined"==typeof t?"undefined":o(t);return null==t||"object"!=n&&"function"!=n||(e=t.then),"function"==typeof e&&e}function n(){for(var t=0;t<this.chain.length;t++)i(this,1===this.state?this.chain[t].success:this.chain[t].failure,this.chain[t]);this.chain.length=0}function i(t,n,i){var r,o;try{n===!1?i.reject(t.msg):(r=n===!0?t.msg:n.call(void 0,t.msg),r===i.promise?i.reject(TypeError("Promise-chain cycle")):(o=e(r))?o.call(r,i.resolve,i.reject):i.resolve(r))}catch(a){i.reject(a)}}function r(i){var o,u=this;if(!u.triggered){u.triggered=!0,u.def&&(u=u.def);try{(o=e(i))?t(function(){var t=new s(u);try{o.call(i,function(){r.apply(t,arguments)},function(){a.apply(t,arguments)})}catch(e){a.call(t,e)}}):(u.msg=i,u.state=1,u.chain.length>0&&t(n,u))}catch(c){a.call(new s(u),c)}}}function a(e){var i=this;i.triggered||(i.triggered=!0,i.def&&(i=i.def),i.msg=e,i.state=2,i.chain.length>0&&t(n,i))}function u(t,e,n,i){for(var r=0;r<e.length;r++)!function(r){t.resolve(e[r]).then(function(t){n(r,t)},i)}(r)}function s(t){this.def=t,this.triggered=!1}function c(t){this.promise=t,this.state=0,this.triggered=!1,this.chain=[],this.msg=void 0}function f(e){if("function"!=typeof e)throw TypeError("Not a function");if(0!==this.__NPO__)throw TypeError("Not a promise");this.__NPO__=1;var i=new c(this);this.then=function(e,r){var o={success:"function"!=typeof e||e,failure:"function"==typeof r&&r};return o.promise=new this.constructor(function(t,e){if("function"!=typeof t||"function"!=typeof e)throw TypeError("Not a function");o.resolve=t,o.reject=e}),i.chain.push(o),0!==i.state&&t(n,i),o.promise},this["catch"]=function(t){return this.then(void 0,t)};try{e.call(void 0,function(t){r.call(i,t)},function(t){a.call(i,t)})}catch(o){a.call(i,o)}}var l,h,d,m=Object.prototype.toString,p="undefined"!=typeof setImmediate?function(t){return setImmediate(t)}:setTimeout;try{Object.defineProperty({},"x",{}),l=function(t,e,n,i){return Object.defineProperty(t,e,{value:n,writable:!0,configurable:i!==!1})}}catch(g){l=function(t,e,n){return t[e]=n,t}}d=function(){function t(t,e){this.fn=t,this.self=e,this.next=void 0}var e,n,i;return{add:function(r,o){i=new t(r,o),n?n.next=i:e=i,n=i,i=void 0},drain:function(){var t=e;for(e=n=h=void 0;t;)t.fn.call(t.self),t=t.next}}}();var v=l({},"constructor",f,!1);return f.prototype=v,l(v,"__NPO__",0,!1),l(f,"resolve",function(t){var e=this;return t&&"object"==("undefined"==typeof t?"undefined":o(t))&&1===t.__NPO__?t:new e(function(e,n){if("function"!=typeof e||"function"!=typeof n)throw TypeError("Not a function");e(t)})}),l(f,"reject",function(t){return new this(function(e,n){if("function"!=typeof e||"function"!=typeof n)throw TypeError("Not a function");n(t)})}),l(f,"all",function(t){var e=this;return"[object Array]"!=m.call(t)?e.reject(TypeError("Not an array")):0===t.length?e.resolve([]):new e(function(n,i){if("function"!=typeof n||"function"!=typeof i)throw TypeError("Not a function");var r=t.length,o=Array(r),a=0;u(e,t,function(t,e){o[t]=e,++a===r&&n(o)},i)})}),l(f,"race",function(t){var e=this;return"[object Array]"!=m.call(t)?e.reject(TypeError("Not an array")):new e(function(n,i){if("function"!=typeof n||"function"!=typeof i)throw TypeError("Not a function");u(e,t,function(t,e){n(e)},i)})}),f})}).call(e,function(){return this}())},function(t,e){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e["default"]={THRESHOLD_PERCENT:0,THRESHOLD_PIXELS:1}},function(t,e,n){"use strict";function i(t){return t&&t.__esModule?t:{"default":t}}function r(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}Object.defineProperty(e,"__esModule",{value:!0});var o=function(){function t(t,e){for(var n=0;n<e.length;n++){var i=e[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(t,i.key,i)}}return function(e,n,i){return n&&t(e.prototype,n),i&&t(e,i),e}}(),a=n(2),u=i(a),s=n(6),c=i(s),f=function(){function t(e,n){var i=arguments.length>2&&void 0!==arguments[2]?arguments[2]:null;r(this,t),this.width=e,this.height=n,this._canvas=u["default"].createCanvas(e,n),this._context=this._canvas.getContext("2d"),this._image=i,i?this._drawImage(this._image):this._imageData=this._context.createImageData(e,n)}return o(t,[{key:"setColorAt",value:function(t,e,n){var i=4*(e*this.width+t);this._imageData.data[i]=255*n.r|0,this._imageData.data[i+1]=255*n.g|0,this._imageData.data[i+2]=255*n.b|0,this._imageData.data[i+3]=255*n.a|0}},{key:"getColorAt",value:function(t,e){var n=4*(this.width*e+t),i=this._imageData.data[n],r=this._imageData.data[n+1],o=this._imageData.data[n+2],a=this._imageData.data[n+3];return new c["default"](i,r,o,a)}},{key:"getImageData",value:function(){return this._imageData}},{key:"setImageData",value:function(t){this._imageData.data.set(t.data)}},{key:"clone",value:function(){var e=new t(this.width,this.height);return e.setImageData(this._imageData),e}},{key:"persist",value:function(){this._context.putImageData(this._imageData,0,0)}},{key:"toBuffer",value:function(){return this.persist(),this._canvas.toBuffer()}},{key:"_drawImage",value:function(t){this._context.drawImage(t,0,0),this._imageData=this._context.getImageData(0,0,this.width,this.height)}},{key:"canvas",get:function(){return this._canvas}},{key:"imageData",get:function(){return this._imageData}}],[{key:"fromBuffer",value:function(e){var n=u["default"].createImage();return n.src=e,new t(n.width,n.height,n)}},{key:"fromImage",value:function(e){return new t(e.width,e.height,e)}}]),t}();e["default"]=f},function(t,e){"use strict";function n(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}Object.defineProperty(e,"__esModule",{value:!0});var i=function(){function t(t,e){for(var n=0;n<e.length;n++){var i=e[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(t,i.key,i)}}return function(e,n,i){return n&&t(e.prototype,n),i&&t(e,i),e}}(),r=function(){function t(e,i,r){var o=arguments.length>3&&void 0!==arguments[3]?arguments[3]:1;n(this,t),this.r=e,this.g=i,this.b=r,this.a=o}return i(t,[{key:"clone",value:function(){return new t(this.r,this.g,this.b,this.a)}},{key:"equals",value:function(t){return this.r===t.r&&this.g===t.g&&this.b===t.b&&this.a===t.a}},{key:"toString",value:function(){return"Color("+this.r+", "+this.g+", "+this.b+", "+this.a+")"}}],[{key:"TRANSPARENT",get:function(){return new t(0,0,0,0)}},{key:"WHITE",get:function(){return new t(1,1,1,1)}},{key:"BLACK",get:function(){return new t(0,0,0,1)}},{key:"RED",get:function(){return new t(1,0,0,1)}}]),t}();e["default"]=r},function(t,e,n){"use strict";function i(t){return t&&t.__esModule?t:{"default":t}}function r(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}Object.defineProperty(e,"__esModule",{value:!0});var o=function(){function t(t,e){for(var n=0;n<e.length;n++){var i=e[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(t,i.key,i)}}return function(e,n,i){return n&&t(e.prototype,n),i&&t(e,i),e}}(),a=n(2),u=i(a),s=n(3),c=i(s),f=n(4),l=i(f),h=n(5),d=i(h),m=n(6),p=i(m),g=n(8),v=i(g),_=function(){function t(e,n){var i=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{};r(this,t),this._imageA=e,this._imageB=n,this._prepareImages(),this._options=u["default"].defaults(i,{maxDelta:20,thresholdType:l["default"].THRESHOLD_PERCENT,maxThreshold:.01,renderComposition:!1,compositionMaskColor:p["default"].RED,maxOffset:0}),this._options.renderComposition&&(this._compositionImage=new v["default"](this._imageA,this._imageB))}return o(t,[{key:"compare",value:function(){var t=this;return new c["default"](function(e,n){var i=Math.min(t._imageA.width,t._imageB.width),r=Math.min(t._imageA.height,t._imageB.height),o=0,a=void 0,u=void 0;for(a=0;a<i;a++)for(u=0;u<r;u++){var s=t._comparePosition(a,u);s||(t._options.renderComposition&&t._compositionImage.setColorAt(a,u,t._options.compositionMaskColor),o++)}var c=o;if(t._options.thresholdType===l["default"].THRESHOLD_PERCENT){var f=i*r;c/=f}var h=c<=t._options.maxThreshold;t._options.renderComposition?t._compositionImage.render().then(function(t){e({differences:o,threshold:c,passed:h,compositionImage:t})}):e({differences:o,threshold:c,passed:h})})}},{key:"_prepareImages",value:function(){var t=Math.max(this._imageA.width,this._imageB.width),e=Math.max(this._imageB.height,this._imageB.height);this._imageA=this._ensureImageDimensions(this._imageA,t,e),this._imageB=this._ensureImageDimensions(this._imageB,t,e)}},{key:"_ensureImageDimensions",value:function(t,e,n){if(t.width===e&&t.height===t.height)return t;t.persist();var i=new d["default"](e,n,t.canvas);return i}},{key:"_calculateColorDelta",value:function(t,e){var n=0;return n+=Math.pow(t.r-e.r,2),n+=Math.pow(t.g-e.g,2),n+=Math.pow(t.b-e.b,2),n+=Math.pow(t.a-e.a,2),Math.sqrt(255*n)}},{key:"_comparePosition",value:function(t,e){var n=this._options,i=n.maxDelta,r=n.maxOffset,o=this._imageA.getColorAt(t,e),a=this._imageB.getColorAt(t,e),u=this._calculateColorDelta(o,a);if(u<i)return!0;if(0===r)return!1;var s=this._imageA,c=s.width,f=s.height,l=Math.max(0,t-r),h=Math.min(c-1,t+r),d=Math.max(0,e-r),m=Math.min(f-1,e+r),p=void 0,g=void 0;for(p=l;p<=h;p++)for(g=d;g<=m;g++)if(p!==t&&g!==e){var v=this._imageA.getColorAt(p,g),_=this._calculateColorDelta(o,v),y=this._imageB.getColorAt(p,g),b=this._calculateColorDelta(o,y);if(Math.abs(b-_)<i&&_>i)return!0}return!1}}]),t}();e["default"]=_},function(t,e,n){"use strict";function i(t){return t&&t.__esModule?t:{"default":t}}function r(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}function o(t,e){if(!t)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return!e||"object"!=typeof e&&"function"!=typeof e?t:e}function a(t,e){if("function"!=typeof e&&null!==e)throw new TypeError("Super expression must either be null or a function, not "+typeof e);t.prototype=Object.create(e&&e.prototype,{constructor:{value:t,enumerable:!1,writable:!0,configurable:!0}}),e&&(Object.setPrototypeOf?Object.setPrototypeOf(t,e):t.__proto__=e)}Object.defineProperty(e,"__esModule",{value:!0});var u=function(){function t(t,e){for(var n=0;n<e.length;n++){var i=e[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(t,i.key,i)}}return function(e,n,i){return n&&t(e.prototype,n),i&&t(e,i),e}}(),s=n(3),c=i(s),f=n(2),l=i(f),h=n(5),d=i(h),m=function(t){function e(t,n){r(this,e),t.persist(),n.persist();var i=o(this,(e.__proto__||Object.getPrototypeOf(e)).call(this,t.width,t.height,t.canvas));return i._imageA=t,i._imageB=n,i}return a(e,t),u(e,[{key:"render",value:function(){var t=this;return new c["default"](function(e,n){t._canvas.width=3*t._imageA.width,t._context.drawImage(t._imageA.canvas,0,0),t._context.drawImage(t._imageB.canvas,2*t._imageA.width,0),t._context.putImageData(t._imageData,t._imageA.width,0),!function(){var n=l["default"].createImage();n.addEventListener("load",function(){e(n)}),n.src=t._canvas.toDataURL("image/png")}()})}}]),e}(d["default"]);e["default"]=m},function(t,e){"use strict";t.exports={name:"rembrandt",version:"0.0.8",description:"Client- and server-side image comparison library",main:"build/node.js",repository:{url:"git://github.com/imgly/rembrandt.git",type:"git"},scripts:{test:"node_modules/.bin/mocha --require test/support test/*.test.js",build:"node_modules/.bin/webpack"},author:"PhotoEditorSDK.com <contact@photoeditorsdk.com>",license:"MIT",dependencies:{canvas:"^1.6.0"},devDependencies:{"babel-core":"^6.17.0","babel-loader":"^6.2.5","babel-preset-es2015":"^6.16.0","babel-register":"^6.16.3",chai:"^3.5.0","chai-as-promised":"^6.0.0","json-loader":"^0.5.4",mocha:"^3.1.2","preprocess-loader":"^0.2.0",should:"^11.1.1","standard-loader":"^5.0.0",webpack:"^1.13.2"}}}])});

(function () {
    let default_floor = 0.5;

    function pairs(str) {
        let pairs = [],
            length = str.length - 1,
            pair;
        for (let i = 0; i < length; i++) {
            pair = str.substr(i, 2);
            if (!/\s/.test(pair)) {
                pairs.push(pair);
            }
        }
        return pairs;
    }

    function similarity(pairs1, pairs2) {
        let union = pairs1.length + pairs2.length,
            hits = 0;

        for (let i = 0; i < pairs1.length; i++) {
            for (let j = 0; j < pairs1.length; j++) {
                if (pairs1[i] == pairs2[j]) {
                    pairs2.splice(j--, 1);
                    hits++;
                    break;
                }
            }
        }
        return 2 * hits / union || 0;
    }

    String.prototype.fuzzy = function (strings, floor) {
        let str1 = this,
            pairs1 = pairs(this);

        floor = typeof floor == 'number' ? floor : default_floor;

        if (typeof(strings) == 'string') {
            return str1.length > 1 && strings.length > 1 && similarity(pairs1, pairs(strings)) >= floor || str1 == strings;
        } else if (strings instanceof Array) {
            let scores = {};

            strings.map(function (str2) {
                scores[str2] = str1.length > 1 ? similarity(pairs1, pairs(str2)) : 1 * (str1 == str2);
            });

            return strings.filter(function (str) {
                return scores[str] >= floor;
            }).sort(function (a, b) {
                return scores[b] - scores[a];
            });
        }
    };
})();

function lookup(arr) {
    let newarr = [];
    for (let i = 0; i < arr.length; i++) {
        newarr.push(arr[i].title.toLowerCase());
    }
    return newarr;
}

function searchfunc(q) {
    let qval = q.toLowerCase().fuzzy(lookup(orders), similarityratio);
    if (qval.length > 0) {
        return qval;
    } else {
        return false;
    }
}

async function search(q) {
    let ignorelist2 = [];
    if (mode == 'Exact') {
        for (let i = 0; i < orders.length; i++) {
            if(orders[i].title.toLowerCase() == q){
                if(ignorelist2.indexOf(i) == -1) {
                    addTab(unescape(orders[i].el), orders[i].title, i.toString(), mode);
                    ignorelist2.push(i);
                }
            }
        }
    } else if (mode == 'Contains Text') {
        for (let i = 0; i < orders.length; i++) {
            if (orders[i].title.toLowerCase().indexOf(q) != -1) {
                if(ignorelist2.indexOf(i) == -1) {
                    addTab(unescape(orders[i].el), orders[i].title, i.toString(), mode);
                    ignorelist2.push(i);
                }
            }
        }
    } else if (mode == 'Relative') {
        let sq = searchfunc(q);
        if (sq) {
            for (let i = 0; i < sq.length; i++) {
                for (let i2 = 0; i2 < orders.length; i2++) {
                    if (orders[i2].title.toLowerCase().indexOf(sq[i]) != -1) {
                        if(ignorelist2.indexOf(i2) == -1) {
                            addTab(unescape(orders[i2].el), orders[i2].title, i.toString() + i2.toString(), mode);
                            ignorelist2.push(i2);
                        }
                    }
                }
            }
        }
    }
    return ignorelist2;
}

function sortwishlist(){
    orders.sort(function (a, b) {
        return a.price - b.price;
    });
}

function startTabs() {
    let tabsdiv = document.createElement('div');
    tabsdiv.className = "tabs";
    let ul = document.createElement('ul');
    ul.className = 'tablist';
    tabsdiv.appendChild(ul);
    let tabdiv = document.createElement('div');
    tabdiv.id = 'tabdiv';
    tabdiv.style.display = "block";
    tabsdiv.appendChild(tabdiv);
    document.getElementById('wishlist-tbody').appendChild(tabsdiv);
}

function addTab(el, title, tabnum, searchtype){
    let li = document.createElement('li');
    let taba = document.createElement('span');
    taba.id = "#tab" + tabnum + tnum;
    taba.innerHTML = title;
    taba.classList.add(searchtype.toLowerCase().replace(" ",""));

    let tabdiv = document.createElement('div');
    tabdiv.id = "tab" + tabnum + tnum;
    tabdiv.innerHTML = el;

    if(tnum == 0){
        taba.classList.add('active');
        tabdiv.style.display = "block";
    }
    else{
        tabdiv.style.display = "none";
    }
    taba.addEventListener('click', function(e) {
        let tab_lists_anchors = document.querySelectorAll(".tablist li span");
        let divs = document.getElementById('tabdiv').childNodes;
        for (let i = 0; i < divs.length; i++) {
            divs[i].style.display = "none";
        }
        for (let i = 0; i < tab_lists_anchors.length; i++) {
            tab_lists_anchors[i].classList.remove("active");
        }
        let clicked_tab = e.target || e.srcElement;
        clicked_tab.classList.add('active');

        document.getElementById('tabdiv').querySelector(clicked_tab.getAttribute('id')).style.display = "block";
    });

    li.appendChild(taba);
    document.getElementsByClassName('tablist')[0].appendChild(li);
    document.getElementById('tabdiv').appendChild(tabdiv);
    tnum++;
}

async function imgTest(imgA, imgB) {
    const rembrandt = new Rembrandt({
        imageA: imgA,
        imageB: imgB,
        thresholdType: Rembrandt.THRESHOLD_PERCENT,
        maxThreshold: 0.99,
        maxDelta: 1,
        maxOffset: 1,
    })
    return new Promise((passed) => {
        rembrandt.compare()
            .then(function (result) {
            passed(result.passed);
        })
    });
}

async function imgsearch(imgschild, ordersclone){
    if(ordersclone.length > 0){
        let ignorelist = [];
        for (let i = 0; i < imgschild.length; i++) {
            for (let i2 = 0; i2 < ordersclone.length; i2++) {
                if(ignorelist.indexOf(i2) == -1) {
                    for (let i3 = 0; i3 < ordersclone[i2].imgs.length; i3++) {
                        let didpass = await imgTest(imgschild[i], base64toBlob(ordersclone[i2].imgs[i3].split('base64,')[1]));
                        if(didpass){
                            if(ignorelist.indexOf(i2) == -1) {
                                addTab(unescape(ordersclone[i2].el), ordersclone[i2].title, i2.toString() + i3.toString(), "images");
                                ignorelist.push(i2);
                            }
                        }
                    }
                }
            }
        }
    }
}

const base64toBlob = function(data) {
    let out = Uint8Array.from(atob(data), c => c.charCodeAt(0));
    return URL.createObjectURL(new Blob([out], { type: 'image/png' }));
};

function convertImgToBase64URL(url){
    return fetch(url)
        .then( response => response.blob() )
        .then( blob => new Promise( callback =>{
        let reader = new FileReader() ;
        reader.onload = function(){ callback([this.result, URL.createObjectURL(blob)]) } ;
        reader.readAsDataURL(blob) ;
    }) ) ;
}

function removeNode(elem){
    elem.parentNode.removeChild(elem);
}

async function finalwishliststart(pricetext){
    if(document.getElementsByClassName('product-main-wrap')){
        let mainel = document.getElementsByClassName('product-main-wrap')[0];
        let wishbtn = mainel.getElementsByClassName('add-wishlist');
        if (wishbtn.length > 0) {
            let imgsblob = [];
            let imgschild = [];
            if(UseSideImgs){
                let imgsall = mainel.getElementsByClassName('images-view-list')[0].childNodes;
                for (let i4 = 0; i4 < imgsall.length; i4++) {
                    if(UseB64Imgs){
                        let base64Img = await convertImgToBase64URL(imgsall[i4].firstChild.firstChild.src);
                        imgschild.push(base64Img[0]);
                        imgsblob.push(base64Img[1]);
                    }
                    else{
                        imgschild.push(imgsall[i4].firstChild.firstChild.src);
                    }
                }
            }
            if(UseInnerHTMLImgs){
                let imgsall2 = mainel.getElementsByClassName('sku-property-list')[0].childNodes;
                for (let i5 = 0; i5 < imgsall2.length; i5++) {
                    if(UseB64Imgs){
                        let base64Img = await convertImgToBase64URL(imgsall2[i5].firstChild.firstChild.src);
                        imgschild.push(base64Img[0]);
                        imgsblob.push(base64Img[1]);
                    }
                    else{
                        imgschild.push(imgsall2[i5].firstChild.firstChild.src);
                    }
                }
            }
            let cloneEl = mainel.getElementsByClassName('product-info')[0].cloneNode(true);
            removeNode(cloneEl.getElementsByClassName('buyer-pretection')[0]);
            removeNode(cloneEl.getElementsByClassName('product-action')[0]);
            removeNode(cloneEl.getElementsByClassName('product-quantity')[0]);
            removeNode(cloneEl.getElementsByClassName('product-title')[0]);

            let neworder = {
                title : mainel.getElementsByClassName('product-title-text')[0].innerText,
                price : pricetext,
                href: document.location.pathname,
                imgs: imgschild,
                el : cloneEl.innerHTML.replace(/[^\x00-\x7F]/g, "")
            };
            let dupnum = orders.find(x => x.href === document.location.pathname);
            if(!dupnum){
                wishbtn[0].addEventListener("click", function () {
                    orders.push(neworder);
                    sortwishlist();
                    GM_SuperValue.set('wishdata', orders);
                });
            }
            else{
                orders.splice(orders.indexOf(dupnum), 1);
            }
            if (orders) {
                let wishb = document.createElement('div');
                let title = document.createElement('h2');
                title.id = 'ui-box-title';
                title.innerHTML = 'Similar Wishlist Items';
                title.style = "cursor: pointer";
                title.addEventListener('click', function(e){
                    let clicked = e.target || e.srcElement;
                    clicked.classList.add('active');
                });
                wishb.id = 'wishlist-tbody';
                wishb.setAttribute('style', 'align:top;position:absolute;width:18%');
                document.getElementById('header').appendChild(title);
                document.getElementById('header').appendChild(wishb);
                waitForEl3();
                GM_registerMenuCommand("Configure", function (){document.querySelector("#ui-box-title").className = "active";});
                startTabs();
                if(useTextSearch){
                    let toignore = await search(neworder.title.toLowerCase());
                    let orderscopy = [];
                    if(filterNamesFromImgs){
                        if(toignore.length > 0){
                            for (let i = 0; i < orders.length; i++) {
                                if(toignore.indexOf(i) == -1){
                                    orderscopy.push(orders[i]);
                                }
                            }
                            if(UseSideImgs || UseInnerHTMLImgs){
                                imgsearch(imgsblob, orderscopy);
                            }
                        }
                        else if(UseSideImgs || UseInnerHTMLImgs){
                            imgsearch(imgsblob, orders);
                        }
                    }
                    else if(UseSideImgs || UseInnerHTMLImgs){
                        imgsearch(imgsblob, orders);
                    }
                }
                else{
                    if(UseSideImgs || UseInnerHTMLImgs){
                        imgsearch(imgsblob, orders);
                    }
                }
            }
        }
    }
}

if (typeof String.prototype.startsWith != 'function') {
    String.prototype.startsWith = function (str) {
        return this.slice(0, str.length) == str;
    };
}

if (typeof String.prototype.endsWith != 'function') {
    String.prototype.endsWith = function (str) {
        return this.slice(-str.length) == str;
    };
}

function formatPrice(text){
    return [text.substring(0, text.indexOf('$') + 1), parseFloat(text.substring(text.indexOf('$') + 1))];
}

function findPrice(listitem){
    let pricerow = listitem.querySelector('div:nth-child(3) > div > div');
    if(pricerow){
        if(pricerow.innerHTML.substring(3).startsWith('$') && pricerow.className != 'total-current'){
            return formatPrice(pricerow.innerText).concat(pricerow);
        }
        else{
            let alldivs = listitem.querySelectorAll("div > div");
            for (let i = 0; i < alldivs.length; i++) {
                if(alldivs[i].innerHTML.substring(3).startsWith('$') && pricerow.className != 'total-current'){
                    return formatPrice(alldivs[i].innerText).concat(alldivs[i]);
                }
            }
        }
    }
    else{
        let alldivs = listitem.querySelectorAll("div > div");
        for (let i = 0; i < alldivs.length; i++) {
            if(alldivs[i].innerHTML.substring(3).startsWith('$') && pricerow.className != 'total-current'){
                return formatPrice(alldivs[i].innerText).concat(alldivs[i]);
            }
        }
    }
}

function findPrice2(listitem){
    if(itemstype == 1){
        let pricerow = listitem.querySelector('div:nth-child(3) > div > div');
        if(pricerow){
            if(pricerow.innerHTML.substring(3).startsWith('$')){
                return formatPrice(pricerow.innerText).concat(pricerow);
            }
            else{
                let alldivs = listitem.querySelectorAll("div > div");
                for (let i = 0; i < alldivs.length; i++) {
                    if(alldivs[i].innerHTML.substring(3).startsWith('$')){
                        return formatPrice(alldivs[i].innerText).concat(alldivs[i]);
                    }
                }
            }
        }
        else{
            let alldivs = listitem.querySelectorAll("div > div");
            for (let i = 0; i < alldivs.length; i++) {
                if(alldivs[i].innerHTML.substring(3).startsWith('$')){
                    return formatPrice(alldivs[i].innerText).concat(alldivs[i]);
                }
            }
        }
    }
    else if(itemstype == 2){
        let pricerow = listitem.querySelector('div:nth-child(2) > div:nth-child(2)');
        if(pricerow){
            if(pricerow.innerText.substring(3).startsWith('$')){
                return formatPrice(pricerow.innerText).concat(pricerow);
            }
            else{
                let alldivs = listitem.querySelectorAll("div > div");
                for (let i = 0; i < alldivs.length; i++) {
                    if(alldivs[i].innerText.substring(3).startsWith('$')){
                        return formatPrice(alldivs[i].innerText).concat(alldivs[i]);
                    }
                }
            }
        }
        else if(pricerow = listitem.querySelector('div:nth-child(2) > div:nth-child(3)')){
            return formatPrice(pricerow.innerText).concat(pricerow);
        }
        else{
            let alldivs = listitem.querySelectorAll("div > div");
            for (let i = 0; i < alldivs.length; i++) {
                if(alldivs[i].innerText.substring(3).startsWith('$')){
                    return formatPrice(alldivs[i].innerText).concat(alldivs[i]);
                }
            }
        }
    }
}

function formatPageShipping(text){
    text = text.substring(text.indexOf('window.runParams = {'));
    text = text.substring(text.indexOf('data: {')+6);
    text = text.substring(0, text.indexOf('csrfToken'));
    text = text.substring(0, text.lastIndexOf(','));
    try{
        return parseFloat(JSON.parse(text).shippingModule.freightCalculateInfo.freight.freightAmount.value);
    }
    catch(e){
        console.log(e);
        pagesearch = false;
        GM_config.set('pagesearch', false);
    }
}

async function getPageShipping(url){
    return new Promise((response) => {
        GM_xmlhttpRequest ( {
            method:     'GET',
            url:        url,
            onload:     function (responseDetails) {
                response(formatPageShipping(responseDetails.responseText));
            }
        } );
    });
}


function formatShipping(text){
    if(text.innerHTML.startsWith('+ Shipping')){
        text = parseFloat(text.innerText.substring(text.innerText.indexOf('$') + 1));
        return text;
    }
    else if(text.innerHTML.startsWith('Free Shipping')){
        return 0;
    }
    else{
        return -1;
    }
}

async function findShipping(listitem){
    let pricerow = listitem.querySelector('div > div:nth-child(2) > div:nth-child(3) > span:nth-child(1)');
    if(pricerow){
        let formattedShipping = formatShipping(pricerow);
        if(formattedShipping != -1){
            return formattedShipping;
        }
        else{
            let alldivs = listitem.querySelectorAll("div > span");
            for (let i = 0; i < alldivs.length; i++) {
                let formattedShipping = formatShipping(alldivs[i]);
                if(formattedShipping != -1){
                    return formattedShipping;
                }
            }
            if(pagesearch){
                let alla = listitem.querySelectorAll("img");
                for (let i = 0; i < alla.length; i++) {
                    return await getPageShipping(alla[i].parentNode.href);
                }
            }
            return 0;
        }
    }
    else{
        let alldivs = listitem.querySelectorAll("div > span");
        for (let i = 0; i < alldivs.length; i++) {
            let formattedShipping = formatShipping(alldivs[i]);
            if(formattedShipping != -1){
                return formattedShipping;
            }
        }
        if(pagesearch){
            let alla = listitem.querySelectorAll("img");
            for (let i = 0; i < alla.length; i++) {
                return await getPageShipping(alla[i].parentNode.href);
            }
        }
        return 0;
    }
}

async function process(listitem){
    if(listitem.getElementsByClassName('item-total-wrap').length <= 0){
        let price = findPrice2(listitem);
        if(price){
            let shipping = await findShipping(listitem);
            let totalPrice = price[1];
            if(shipping){
                totalPrice += shipping;
                price[2].innerHTML = price[2].innerHTML + " (+ $" + shipping + " Shipping)";
            }
            totalPrice = totalPrice.toFixed(2);
            var finalcostdiv = document.createElement('div');
            finalcostdiv.style = "display: table-row;";
            finalcostdiv.className = 'item-total-wrap ' + price[2].className;
            var pricepretext = price[0];
            var finalcostpretext = document.createElement('span');
            finalcostpretext.className = 'total-pretext';
            finalcostpretext.innerHTML = "Total: " + pricepretext;
            var finalcostspan = document.createElement('span');
            finalcostspan.className = 'total-current';
            finalcostspan.innerHTML = totalPrice;
            finalcostdiv.appendChild(finalcostpretext);
            finalcostdiv.appendChild(finalcostspan);
            price[2].parentNode.style = "display: table;";
            price[2].style = "display: table-row;";
            price[2].parentNode.appendChild(finalcostdiv);
        }
        if(itemstype == 1){
            sortall(document.querySelectorAll("div.product-container > div + div > div"));
        }
        else{
            sortall(document.querySelectorAll("div.product-container > div + div > a"));
        }
    }
}

var observer = new MutationObserver(function(mutations) {
    if(!sortingnow){
        mutations.forEach(function(mutation) {
            if(mutation.type == 'childList'){
                for (var j = 0; j < mutation.addedNodes.length; j++) {
                    process(mutation.addedNodes[j]);
                }
            }
        });
    }
});

function waitForEl(){
    var observera = new MutationObserver(function (mutations, me) {
        if(document.querySelector("div.product-container > div + div")) {
            me.disconnect();
            if(document.location.href.indexOf('g=y') == -1){
                observer.observe(document.querySelector("div.product-container > div + div"), { childList: true, subtree: true });
            }
            else{
                observer.observe(document.querySelector("div.product-container > div + div"), { childList: true });
            }
            return;
        }
    });

    observera.observe(document, {
        childList: true,
        subtree: true
    });
}

function processall(list){
    for (var i = 0; i < list.length; i++) {
        process(list[i]);
    }
}

async function sortall(listitems){
    sortingnow = true;
    if(sortmethod == 1){
        await tinysort(listitems,{selector:'span.total-current', natural:true});
    }
    else if(sortmethod == 2){
        await tinysort(listitems,{selector:'span.total-current', natural:true});
    }
    else if(sortmethod == 3){
        await tinysort(listitems,{selector:'span.price-current', natural:true});
    }
    if(sortmethod == 4){
        await tinysort(listitems,{selector:'span.total-current', natural:true});
    }
    else if(sortmethod == 5){
        await tinysort(listitems,{selector:'span.price-current', natural:true, order: 'desc'});
    }
    sortingnow = false;
}

function SortRows(mode){
    sortmethod = mode;
    if(itemstype == 1){
        sortall(document.querySelectorAll("div.product-container > div + div > div"));
    }
    else{
        sortall(document.querySelectorAll("div.product-container > div + div > a"));
    }
    fakeScrollDown();
}
function insertsearch(){
    var sortdiv = document.createElement('div');
    sortdiv.className = 'sort-item';
    var sortspan = document.createElement('div');
    sortspan.className = 'sort-item';
    var sortspan2 = document.createElement('div');
    sortspan2.className = 'sort-item';
    var sortspan3 = document.createElement('div');
    sortspan3.className = 'sort-item';
    var sortspan4 = document.createElement('div');
    sortspan4.className = 'sort-item';
    var sortspan5 = document.createElement('div');
    sortspan5.className = 'sort-item';
    var sortchange = document.createElement('div');
    sortchange.id = 'sortchange1';
    sortchange.innerHTML = GM_config.fields.sortmethod.settings.options[0];
    sortchange.addEventListener("click", function () {
        SortRows(0)
    }, false);
    var sortchange2 = document.createElement('div');
    sortchange2.id = 'sortchange2';
    sortchange2.innerHTML = GM_config.fields.sortmethod.settings.options[1];
    sortchange2.addEventListener("click", function () {
        SortRows(1)
    }, false);
    var sortchange3 = document.createElement('div');
    sortchange3.id = 'sortchange3';
    sortchange3.innerHTML = GM_config.fields.sortmethod.settings.options[2];
    sortchange3.addEventListener("click", function () {
        SortRows(2)
    }, false);
    var sortchange4 = document.createElement('div');
    sortchange4.id = 'sortchange4';
    sortchange4.innerHTML = GM_config.fields.sortmethod.settings.options[3];
    sortchange4.addEventListener("click", function () {
        SortRows(3)
    }, false);
    var sortchange5 = document.createElement('label');
    sortchange5.id = 'sortchange5';
    sortchange5.innerHTML = GM_config.fields.sortmethod.settings.options[4] + ': ';
    var sortchange5t = document.createElement('input');
    sortchange5t.id = 'sortchange5t';
    sortchange5t.addEventListener("keydown", function () {
        SortRows(4)
    }, false);
    sortspan.appendChild(sortchange);
    sortspan2.appendChild(sortchange2);
    sortspan3.appendChild(sortchange3);
    sortspan4.appendChild(sortchange4);
    sortspan5.appendChild(sortchange5);
    sortspan5.appendChild(sortchange5t);
    sortdiv.appendChild(sortspan);
    sortdiv.appendChild(sortspan2);
    sortdiv.appendChild(sortspan3);
    sortdiv.appendChild(sortspan4);
    sortdiv.appendChild(sortspan5);
    var searchbox = document.querySelector(".sort-by-wrapper");
    if(searchbox){
        searchbox.appendChild(sortdiv);
        document.getElementById('sortchange' + sortmethod.toString()).setAttribute('style', 'font-weight: bold');
    }
}

function process2(item){
    if(item.className == "item-info"){
        if(item.querySelector("div.item-title.line-limit-length")){
            item.querySelector("div.item-title.line-limit-length").classList.remove('line-limit-length');
            item.parentNode.parentNode.style.height = "auto";
        }
    }
}

function checkall(list){
    for (var i = 0; i < list.length; i++) {
        process2(list[i]);
    }
}

var observer2 = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        if(mutation.type == 'childList'){
            for (var j = 0; j < mutation.addedNodes.length; j++) {
                checkall(mutation.addedNodes[j].childNodes);
            }
        }
    });
});

function waitForEl2(){
    var observerb = new MutationObserver(function (mutations, me) {
        if(document.querySelector(".item-title-block")) {
            me.disconnect();
            observer2.observe(document.querySelector(".bottom-recommendation"), { childList: true, subtree: true });
            return;
        }
    });

    observerb.observe(document, {
        childList: true,
        subtree: true
    });
}

function waitForEl3(){
    var observerb = new MutationObserver(function (mutation) {
        if(mutation[0].target.className == 'active') {
            GM_config.open();
            mutation[0].target.className = '';
            return;
        }
    });

    observerb.observe(document.querySelector("#ui-box-title"), {
        attributes: true
    });
}

function fakeScrollDown(){
    setTimeout((function(){
        window.scrollByPages(1);;
        if(window.scrollY < window.scrollMaxY){
            fakeScrollDown();
        }
        else{
            window.scrollTo(0,0);
        }
    }),100);
}

function docalctotal(){
    var itempageshipping = document.querySelector('.product-shipping-price');
    if(itempageshipping){
        itempageshipping = itempageshipping.innerText;
        if(itempageshipping.indexOf('Free Shipping') != -1){
            itempageshipping = '0.00';
        }
        itempageshipping = parseFloat(itempageshipping.substring(itempageshipping.indexOf('$')+1).trimEnd());
        var itempageprice = document.querySelector('.product-price-value');
        if(itempageprice){
            itempageprice = itempageprice.innerText;
            var preprice = itempageprice.substring(itempageprice.indexOf(':')+1, itempageprice.indexOf('$')+1);
            itempageprice = parseFloat(itempageprice.substring(itempageprice.indexOf('$')+1).trimEnd());
            var itempagetotal = parseFloat(itempageshipping + itempageprice).toFixed(2).toString();
            var finalcostpretext = document.createElement('span');
            finalcostpretext.className = 'total-pretext';
            finalcostpretext.innerHTML = "Total: " + preprice + itempagetotal;
            finalcostpretext.style.fontSize = "24px";
            finalcostpretext.style.fontWeight = "700";
            var finalcostdiv = document.createElement('div');
            finalcostdiv.className = 'total-current';
            finalcostdiv.appendChild(finalcostpretext);
            var insertitemtotal = document.querySelector('.product-action');
            if(insertitemtotal){
                var pretextitem = document.querySelector('.total-pretext');
                if(pretextitem){
                    pretextitem.innerHTML = "Total: " + preprice + itempagetotal;
                }
                else{
                    insertitemtotal.parentNode.insertBefore(finalcostdiv, insertitemtotal);
                }
                finalwishliststart(itempagetotal);
            }
        }
    }
}

function calctotal(){
    var proplist = document.querySelector('.sku-wrap');
    if(proplist && proplist.childNodes.length > 0){
        var proplistall = proplist.querySelectorAll('.sku-property');
        for (var i = 0; i < proplistall.length; i++) {
            var propitem = proplistall[i].querySelectorAll('.sku-property-item');
            if(propitem && propitem.length > 0){
                if(!propitem[0].classList.contains('selected')){
                    propitem[0].click();
                }
                for (var i2 = 0; i2 < propitem.length; i2++) {
                    propitem[i2].addEventListener('click', function() {
                        setTimeout((function(){
                            docalctotal();
                        }),1000);
                    });
                }
            }
        }
        setTimeout((function(){
            docalctotal();
        }),1000);
    }
    else{
        docalctotal();
    }
}

function getshippingdates(){
    var deliverydiv = document.querySelector('.product-shipping-delivery');
    if(deliverydiv){
        var shippingtime = deliverydiv.childNodes[1].innerText;
        var shippingtime1 = shippingtime.split('-');
        var shippingtime2 = shippingtime1[1];
        shippingtime1 = shippingtime1[0];
        var today = new Date();
        if(shippingtime2){
            let deliveryDateFrom = new Date(today.getTime() + (shippingtime1 * 24 * 60 * 60 * 1000)).toLocaleDateString();
            let deliveryDateTo = new Date(today.getTime() + (shippingtime2 * 24 * 60 * 60 * 1000)).toLocaleDateString();
            var finaldeliverydatepretext = document.createElement('span');
            finaldeliverydatepretext.className = 'date-pretext';
            finaldeliverydatepretext.innerHTML = "(" + deliveryDateFrom + " - " + deliveryDateTo + ")";
            var finaldeliverydate = document.createElement('div');
            finaldeliverydate.className = 'total-date';
            finaldeliverydate.appendChild(finaldeliverydatepretext);
            deliverydiv.parentNode.insertBefore(finaldeliverydate, deliverydiv.nextSibling);
        }
    }
}

function injecthiddencftrigger(){
    let title = document.createElement('input');
    title.type = 'hidden';
    title.id = 'ui-box-title';
    title.addEventListener('click', function(e){
        let clicked = e.target || e.srcElement;
        clicked.classList.add('active');
    });
    document.body.appendChild(title);
    waitForEl3();
    GM_registerMenuCommand("Configure", function (){document.querySelector("#ui-box-title").className = "active";});
}

if(document.location.href.indexOf('/wholesale') != -1 || document.location.href.indexOf('/category') != -1 || document.location.href.indexOf('/af') != -1){
    injecthiddencftrigger();
    waitForEl();
    let allitems = document.querySelectorAll("div.product-container > div + div > a");
    if(allitems.length > 0){
        processall(allitems);
    }
    else{
        itemstype = 1;
        allitems = document.querySelectorAll("div.product-container > div + div > div");
        processall(allitems);
    }
    insertsearch();
    fakeScrollDown();
}
else if(document.location.href.indexOf('/item') != -1){
    waitForEl2();
    setTimeout((function(){
        checkall(document.querySelectorAll(".item-info"));
        calctotal();
        getshippingdates();
    }),2000);
}
