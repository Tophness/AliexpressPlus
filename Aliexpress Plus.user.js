// ==UserScript==
// @name         Aliexpress Plus
// @namespace    http://www.facebook.com/Tophness
// @version      3.3.5
// @description  Sorts search results by item price properly with shipping costs included, enhances item pages
// @author       Tophness
// @match        https://*.aliexpress.com/w/wholesale*
// @match        https://*.aliexpress.com/wholesale*
// @match        https://*.aliexpress.com/category*
// @match        https://*.aliexpress.com/af/*
// @match        https://*.aliexpress.com/item/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/tinysort/2.3.6/tinysort.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/tinysort/2.3.6/tinysort.charorder.min.js
// @require      https://cdn.jsdelivr.net/npm/rembrandt@0.1.3/build/browser.min.js
// @require      https://openuserjs.org/src/libs/sizzle/GM_config.min.js
// @updateURL    https://openuserjs.org/meta/Tophness/Aliexpress_Plus.meta.js
// @downloadURL  https://openuserjs.org/install/Tophness/Aliexpress_Plus.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// @license      MIT
// @copyright    2014, Tophness (https://openuserjs.org/users/Tophness)
// ==/UserScript==

if (window.top != window.self) {
    return;
}

var tnum = 0;
var sortingnow = false;
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
            'sortmode': {
                label: 'Search: Sort Mode',
                type: 'select',
                options: [ 'Cheapest Unit Price', 'Cheapest Total Price', 'Cheapest Total Price (Max Price)', 'Cheapest Price', 'Max Price' ],
                default: 'Cheapest Total Price'
            },
            'pagesearch': {
                label: 'Search: Open pages and scrape shipping details if missing from search',
                type: 'checkbox',
                default: true
            },
            'windowmode': {
                label: 'Search: Item Scraping Mode',
                type: 'select',
                options: [ 'unSafeWindow', 'DOM' ],
                default: 'unSafeWindow'
            },
            'getextraitems': {
                label: 'Search: Get Extra Items In unSafeWindow Mode',
                type: 'checkbox',
                default: true
            },
            'itemsunsafewindowmode': {
                label: 'Wishlist: Get Shipping using unSafeWindow Mode',
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
var UseSideImgs = GM_config.get('UseSideImgs');
var UseInnerHTMLImgs = GM_config.get('UseInnerHTMLImgs');
var useTextSearch = GM_config.get('useTextSearch');
var mode = GM_config.get('mode');
var similarityratio = GM_config.get('similarity');
var sortmethod = GM_config.fields.sortmode.settings.options.indexOf(GM_config.get('sortmode'))+1;
var pagesearch = GM_config.get('pagesearch');
var unsafewindowmode = GM_config.fields.windowmode.settings.options.indexOf(GM_config.get('windowmode'))+1;
var getextraitems = GM_config.get('getextraitems');
var itemsunsafewindowmode = GM_config.get('itemsunsafewindowmode');
GM_addStyle(".tabs{overflow:hidden;clear:both;} .tabs ul{list-style-type:none;bottom: -1px;position:relative;} .tabs li{float:left;} .tablist span{cursor: pointer;display:block;padding:5px 10px;text-decoration: none;margin: 0 4px;border-top:1px solid #CCC;border-left:1px solid #DDD;border-right:1px solid #DDD;font:13px/18px verdana,arial,sans-serif;border-bottom:1px solid #CCC;} .tablist span.exact{background-color: red;color: #fff;} .tablist span.containstext{background-color: blue;color: #fff;} .tablist span.relative{background-color: green;color: #fff;} .tablist span.images{background-color: yellow;color: #000;} .tablist span.active{background-color: #eee;color: #000;border-bottom:1px solid #fff;} .sku-property-text2{visibility: hidden; background-color: black; color: #fff; text-align: left; padding: 5px 0; border-radius: 6px; position: absolute; z-index: 1;} .sku-property-item:hover .sku-property-text2 {visibility: visible;}");

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

function base64toBlob(data) {
    let out = Uint8Array.from(atob(data), c => c.charCodeAt(0));
    return URL.createObjectURL(new Blob([out], { type: 'image/png' }));
}

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
                if(mainel.getElementsByClassName('images-view-list').length > 0){
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
            }
            if(UseInnerHTMLImgs){
                let proplist = mainel.getElementsByClassName('sku-property-list');
                if(proplist.length > 0){
                    for (let i5 = 0; i5 < proplist.length; i5++) {
                        let imgsall2 = proplist[i5].childNodes;
                        for (let i6 = 0; i6 < imgsall2.length; i6++) {
                            if(imgsall2[i6].firstChild.firstChild.src){
                                if(UseB64Imgs){
                                    let base64Img = await convertImgToBase64URL(imgsall2[i6].firstChild.firstChild.src);
                                    imgschild.push(base64Img[0]);
                                    imgsblob.push(base64Img[1]);
                                }
                                else{
                                    imgschild.push(imgsall2[i6].firstChild.firstChild.src);
                                }
                            }
                        }
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
                let wishbox = document.createElement('div');
                wishbox.id = 'wishbox';
                wishbox.style="float: left; padding-left: 5px;";
                let wishb = document.createElement('div');
                let title = document.createElement('h2');
                title.id = 'ui-box-title';
                title.innerHTML = 'Similar Wishlist Items';
                title.style = "cursor: pointer; padding-left: 5px;";
                title.addEventListener('click', function(e){
                    let clicked = e.target || e.srcElement;
                    clicked.classList.add('active');
                });
                wishb.id = 'wishlist-tbody';
                wishb.setAttribute('style', 'align:top; position:absolute; width:18%; padding-left: 5px;');
                wishbox.appendChild(title);
                wishbox.appendChild(wishb);
                document.querySelector('.glodetail-wrap').prepend(wishbox);
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

function formatPrice2(text){
    return parseFloat(text.substring(text.indexOf('$') + 1));
}

function getPriceFromParams(params){
    try{
        if(params.shippingModule.freightCalculateInfo.freight){
            return parseFloat(params.shippingModule.freightCalculateInfo.freight.freightAmount.value);
        }
        else{
            let multishipping = params.shippingModule.generalFreightInfo;
            if(multishipping){
                let freightAmounts = multishipping.originalLayoutResultList;
                if(freightAmounts){
                    if(freightAmounts.length > 0){
                        if(freightAmounts[0].bizData.formattedAmount){
                            freightAmounts.sort(function (a, b) {
                                return formatPrice2(a.bizData.formattedAmount) - formatPrice2(b.bizData.formattedAmount);
                            });
                            return(formatPrice2(freightAmounts[0].bizData.formattedAmount));
                        }
                        else{
                            return(0);
                        }
                    }
                    else{
                        return(0);
                    }
                }
                else{
                    return(0);
                }
            }
            else{
                return(0);
            }
        }
    }
    catch(e){
        console.log(e);
        pagesearch = false;
        GM_config.set('pagesearch', false);
        return(0);
    }
}

function formatPageShipping(text){
    try{
        text = text.substring(text.indexOf('window.runParams = {'));
        text = text.substring(text.indexOf('data: {')+6);
        text = text.substring(0, text.indexOf('csrfToken'));
        text = text.substring(0, text.lastIndexOf(','));
        if(text.length > 0){
            return(getPriceFromParams(JSON.parse(text)));
        }
        else{
            return(0);
        }
    }
    catch(e){
        console.log(e);
        pagesearch = false;
        GM_config.set('pagesearch', false);
        return(0);
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

function formatPrice(text){
    return [text.substring(0, text.indexOf('$') + 1), parseFloat(text.substring(text.indexOf('$') + 1))];
}

function findPrice(listitem){
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
        let price = findPrice(listitem);
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
        SortRows(sortmethod);
    }
}

var observer = new MutationObserver(function(mutations, me) {
    if(!sortingnow){
        mutations.forEach(function(mutation) {
            if(mutation.type == 'childList'){
                for (var j = 0; j < mutation.addedNodes.length; j++) {
                    process(mutation.addedNodes[j]);
                }
            }
        });
    }
    else{
        me.disconnect();
    }
});

function waitForEl(){
    var observera = new MutationObserver(function (mutations, me) {
        if(document.querySelector("div.product-container > div + div")) {
            me.disconnect();
            observer.observe(document.querySelector("div.product-container > div + div"), { childList: true });
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

function createItem(productid, imgsrc, title, storename, storelink, currencycode, price, shipping, itemstype2, extraitems) {
    var container = document.createDocumentFragment();
    let link = 'https://www.aliexpress.com/item/' + productid + '.html';
    if(itemstype2 == 1){
        let e_1 = document.createElement("div");
        e_1.setAttribute("class", "_1OUGS");
        let e_2 = document.createElement("a");
        e_2.setAttribute("class", "_9tla3");
        e_2.setAttribute("href", link);
        e_2.setAttribute("target", "_blank");
        let e_3 = document.createElement("img");
        e_3.setAttribute("src", imgsrc);
        e_3.setAttribute("class", "A3Q1M");
        e_3.setAttribute("alt", title);
        e_2.appendChild(e_3);
        let e_4 = document.createElement("div");
        let e_5 = document.createElement("div");
        e_5.setAttribute("class", "report-btn-wrap");
        let e_6 = document.createElement("span");
        e_6.setAttribute("class", "report-item");
        e_6.setAttribute("title", "Report fraud item");
        e_5.appendChild(e_6);
        e_4.appendChild(e_5);
        e_2.appendChild(e_4);
        e_1.appendChild(e_2);
        let e_7 = document.createElement("div");
        e_7.setAttribute("class", "atwl-btn-wrap");
        let e_8 = document.createElement("a");
        e_8.setAttribute("class", "_9tla3");
        e_8.setAttribute("href", link);
        e_8.setAttribute("target", "_blank");
        e_7.appendChild(e_8);
        let e_9 = document.createElement("a");
        e_9.setAttribute("class", "add-wishlist-btn");
        e_9.setAttribute("data-p4p", "true");
        let e_10 = document.createElement("i");
        e_10.setAttribute("data-p4p", "true");
        e_10.setAttribute("class", "next-icon next-icon-favourite next-medium");
        e_9.appendChild(e_10);
        e_7.appendChild(e_9);
        e_1.appendChild(e_7);
        let e_11 = document.createElement("div");
        e_11.setAttribute("class", "_3L3yc");
        let e_12 = document.createElement("div");
        e_12.setAttribute("class", "_2mXVg _89Qo8");
        let e_13 = document.createElement("a");
        e_13.setAttribute("class", "awV9E");
        e_13.setAttribute("target", "_blank");
        e_13.setAttribute("title", title);
        e_13.setAttribute("href", link);
        let e_14 = document.createElement("span");
        e_14.appendChild(document.createTextNode(title));
        e_13.appendChild(e_14);
        e_12.appendChild(e_13);
        e_11.appendChild(e_12);
        let e_15 = document.createElement("div");
        e_15.setAttribute("class", "_2mXVg");
        let pricepretext = document.createElement("span");
        pricepretext.setAttribute("class", "pricepretext");
        pricepretext.appendChild(document.createTextNode(currencycode + " $"));
        e_15.appendChild(pricepretext);
        let e_16 = document.createElement("span");
        e_16.setAttribute("class", "price-current");
        e_16.appendChild(document.createTextNode(price));
        e_15.appendChild(e_16);
        e_11.appendChild(e_15);
        let e_17 = document.createElement("div");
        e_17.setAttribute("class", "_2mXVg VoRWN");
        e_11.appendChild(e_17);
        let e_18 = document.createElement("div");
        e_18.setAttribute("class", "_2mXVg");
        let e_19 = document.createElement("span");
        e_19.setAttribute("class", "ZCLbI");
        e_11.appendChild(e_18);
        if(shipping == 0){
            e_19.appendChild(document.createTextNode("Free Shipping"));
        }
        else{
            e_19.appendChild(document.createTextNode("+ Shipping: " + currencycode + " $" + shipping));
        }
        e_18.appendChild(e_19);
        if(extraitems){
            for (let i = 0; i < extraitems.length; i++) {
                let extraitem = document.createElement("span");
                extraitem.setAttribute("class", "ZCLbI");
                extraitem.appendChild(document.createTextNode(extraitems[i]));
                e_11.appendChild(extraitem);
            }
        }
        let e_21 = document.createElement("div");
        e_21.setAttribute("class", "_1iaNr");
        e_11.appendChild(e_21);
        let totaldiv = document.createElement("div");
        totaldiv.setAttribute("class", "_2mXVg");
        let pretext = document.createElement("span");
        pretext.appendChild(document.createTextNode("Total: " + currencycode + " $"));
        pretext.setAttribute("class", "total-current _12A8D");
        let e_20 = document.createElement("span");
        e_20.setAttribute("class", "total-current _12A8D");
        e_20.appendChild(document.createTextNode((parseFloat(price) + parseFloat(shipping)).toFixed(2).toString()));
        pretext.appendChild(e_20);
        totaldiv.appendChild(pretext);
        e_11.appendChild(totaldiv);
        let e_22 = document.createElement("div");
        e_22.setAttribute("class", "_2mXVg");
        let e_23 = document.createElement("span");
        e_23.setAttribute("class", "_2jR_A");
        let e_24 = document.createElement("a");
        e_24.setAttribute("class", "_2lsU7");
        e_24.setAttribute("href", storelink);
        e_24.setAttribute("target", "_blank");
        e_24.appendChild(document.createTextNode(storename));
        e_23.appendChild(e_24);
        e_22.appendChild(e_23);
        e_11.appendChild(e_22);
        e_1.appendChild(e_11);
        container.appendChild(e_1);
    }
    else{
        let e_0 = document.createElement("div");
        e_0.setAttribute("class", "_2E_KG");
        let e_1 = document.createElement("a");
        e_1.setAttribute("class", "_9tla3");
        e_1.setAttribute("href", link);
        e_1.setAttribute("target", "_blank");
        let e_2 = document.createElement("img");
        e_2.setAttribute("src", imgsrc);
        e_2.setAttribute("class", "A3Q1M");
        e_2.setAttribute("alt", title);
        e_1.appendChild(e_2);
        let e_3 = document.createElement("div");
        let e_4 = document.createElement("div");
        e_4.setAttribute("class", "report-btn-wrap");
        let e_5 = document.createElement("span");
        e_5.setAttribute("class", "report-item");
        e_5.setAttribute("title", "Report fraud item");
        e_4.appendChild(e_5);
        e_3.appendChild(e_4);
        e_1.appendChild(e_3);
        e_0.appendChild(e_1);
        let e_6 = document.createElement("div");
        e_6.setAttribute("class", "atwl-btn-wrap");
        let e_7 = document.createElement("a");
        e_7.setAttribute("class", "_9tla3");
        e_7.setAttribute("href", link);
        e_7.setAttribute("target", "_blank");
        e_6.appendChild(e_7);
        let e_8 = document.createElement("a");
        e_8.setAttribute("class", "add-wishlist-btn");
        e_8.setAttribute("data-p4p", "true");
        let e_9 = document.createElement("i");
        e_9.setAttribute("data-p4p", "true");
        e_9.setAttribute("class", "next-icon next-icon-favourite next-medium");
        e_8.appendChild(e_9);
        e_6.appendChild(e_8);
        e_0.appendChild(e_6);
        let e_10 = document.createElement("div");
        e_10.setAttribute("class", "_2mXVg _3GzBz");
        let e_11 = document.createElement("div");
        e_11.setAttribute("class", "_2mXVg _89Qo8");
        let e_12 = document.createElement("a");
        e_12.setAttribute("class", "awV9E");
        e_12.setAttribute("target", "_blank");
        e_12.setAttribute("title", title);
        e_12.setAttribute("href", link);
        let e_13 = document.createElement("span");
        e_13.appendChild(document.createTextNode(title));
        e_12.appendChild(e_13);
        e_11.appendChild(e_12);
        e_10.appendChild(e_11);
        let e_14 = document.createElement("div");
        e_14.setAttribute("class", "_2mXVg VoRWN");
        e_10.appendChild(e_14);
        let e_15 = document.createElement("div");
        e_15.setAttribute("class", "_2mXVg");
        let pricepretext = document.createElement("span");
        pricepretext.setAttribute("class", "pricepretext");
        pricepretext.appendChild(document.createTextNode(currencycode + " $"));
        e_15.appendChild(pricepretext);
        let e_16 = document.createElement("span");
        e_16.setAttribute("class", "price-current");
        e_16.appendChild(document.createTextNode(price));
        e_15.appendChild(e_16);
        e_10.appendChild(e_15);
        let e_17 = document.createElement("span");
        e_17.setAttribute("class", "ZCLbI");
        if(shipping == 0){
            e_17.appendChild(document.createTextNode("Free Shipping"));
        }
        else{
            e_17.appendChild(document.createTextNode("+ Shipping: " + currencycode + " $" + shipping));
        }
        e_10.appendChild(e_17);
        if(extraitems){
            for (let i = 0; i < extraitems.length; i++) {
                let extraitem = document.createElement("span");
                extraitem.setAttribute("class", "ZCLbI");
                extraitem.appendChild(document.createTextNode(extraitems[i]));
                e_10.appendChild(extraitem);
            }
        }
        let e_18 = document.createElement("div");
        e_18.setAttribute("class", "_1iaNr");
        e_10.appendChild(e_18);
        let e_19 = document.createElement("span");
        e_19.setAttribute("class", "_2jR_A");
        let e_20 = document.createElement("a");
        e_20.setAttribute("class", "_2lsU7");
        e_20.setAttribute("href", storelink);
        e_20.setAttribute("target", "_blank");
        e_20.appendChild(document.createTextNode(storename));
        e_19.appendChild(e_20);
        e_10.appendChild(e_19);
        e_0.appendChild(e_10);
        let e_21 = document.createElement("div");
        e_21.setAttribute("class", "_2mXVg BAu5c");
        let e_22 = document.createElement("div");
        e_22.setAttribute("class", "_2mXVg");
        let pretext = document.createElement("span");
        pretext.setAttribute("class", "_12A8D");
        pretext.appendChild(document.createTextNode("Total: " + currencycode + " $"));
        let e_23 = document.createElement("span");
        e_23.setAttribute("class", "total-current _12A8D");
        e_23.appendChild(document.createTextNode((parseFloat(price) + parseFloat(shipping)).toFixed(2).toString()));
        e_22.appendChild(pretext);
        e_22.appendChild(e_23);
        e_21.appendChild(e_22);
        let e_24 = document.createElement("div");
        e_24.setAttribute("class", "_1iaNr");
        e_21.appendChild(e_24);
        e_0.appendChild(e_21);
        container.appendChild(e_0);
    }
    return container;
}

async function findShipping2(sellingpoints, productid){
    if(sellingpoints){
        for (let i = 0; i < sellingpoints.length; i++) {
            if(sellingpoints[i].tagContent && sellingpoints[i].tagContent.tagText){
                if(sellingpoints[i].tagContent.tagText.indexOf("+ Shipping") != -1){
                    return parseFloat(sellingpoints[i].tagContent.tagText.substring(sellingpoints[i].tagContent.tagText.indexOf('$') + 1));
                }
                else if(sellingpoints[i].tagContent.tagText.indexOf("Free Shipping") != -1){
                    return 0;
                }
            }
        }
    }
    if(pagesearch){
        return await getPageShipping('https://www.aliexpress.com/item/' + productid + '.html');
    }
    else{
        return 0;
    }
}

async function findExtras(sellingpoints){
    let extraitems = []
    if(sellingpoints){
        for (let i = 0; i < sellingpoints.length; i++) {
            if(sellingpoints[i].tagContent && sellingpoints[i].tagContent.tagText){
                if(sellingpoints[i].tagContent.tagText.indexOf("+ Shipping") == -1 && sellingpoints[i].tagContent.tagText.indexOf("Free Shipping") == -1){
                    extraitems.push(sellingpoints[i].tagContent.tagText);
                }
            }
        }
    }
    return extraitems;
}

function removeall(items, parent){
    for (let i = 0; i < items.length; i++) {
        parent.removeChild(items[i]);
    }
}

function appendall(items, parent){
    for (let i = 0; i < items.length; i++) {
        parent.appendChild(items[i]);
    }
}

async function waitforparams(){
    return new Promise((params) => {
        if(unsafeWindow.runParams){
            params(unsafeWindow.runParams);
        }
        else{
            setTimeout(waitforparams, 500);
        }
    });
}

async function getParams(){
    return new Promise((params) => {
        let retparams = waitforparams();
        params(retparams);
    });
}

async function processall3(runparams = null){
    if(!runparams){
        runparams = await getParams();
    }
    let allitems = runparams.mods.itemList.content;
    let currencycode = runparams.exposureParams.ship_to;
    let newitems = [];
    let itemstype2 = 1;
    if(document.location.href.indexOf('g=n') != -1){
        itemstype2 = 2;
    }
    for (let i = 0; i < allitems.length; i++) {
        let productid = allitems[i].productId, imgsrc = allitems[i].image.imgUrl, title = allitems[i].title.displayTitle, storename = allitems[i].store.storeName, storelink = allitems[i].store.storeUrl, price = allitems[i].prices.salePrice.minPrice, shipping = await findShipping2(allitems[i].sellingPoints, productid);
        let extraitems = [];
        if(getextraitems){
            extraitems = await findExtras(allitems[i].sellingPoints);
        }
        newitems.push(createItem(productid, imgsrc, title, storename, storelink, currencycode, price, shipping, itemstype2, extraitems));
    }
    let metaparent = document.querySelector("div.product-container");
    let before = metaparent.querySelector('div.list-pagination');
    //let metaparent = document.querySelector("div.product-container > div");
    let parent = document.querySelector("div.product-container > div + div");
    let oldclassname = parent.className;
    parent.parentNode.removeChild(parent);
    let newparent = document.createElement("div");
    newparent.id = "listitems";
    newparent.className = oldclassname;
    appendall(newitems, newparent);
    metaparent.insertBefore(newparent, before);
    //metaparent.appendChild(newparent);
    SortRows(sortmethod);
}

async function sortall(listitems, sortmethod){
    if(unsafewindowmode == 2){
        sortingnow = true;
        observer.disconnect();
    }
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
        for (let i = 0; i < listitems.length; i++) {
            if(parseFloat(listitems[i].getElementsByClassName('price-current')[0].innerText) > parseFloat(document.getElementById('sortchange5t').value)){
                listitems[i].style="display:none;";
            }
            else{
                listitems[i].style="";
            }
        }
    }
    if(unsafewindowmode == 2){
        sortingnow = false;
        observer.observe(document.querySelector("div.product-container > div + div"), { childList: true });
    }
}

function SortRows(sortmethod){
    if(unsafewindowmode == 1){
        sortall(document.querySelector("#listitems").childNodes,sortmethod);
    }
    else{
        if(itemstype == 1){
            sortall(document.querySelectorAll("div.product-container > div + div > div"),sortmethod);
        }
        else{
            sortall(document.querySelectorAll("div.product-container > div + div > a"),sortmethod);
        }
        fakeScrollDown();
    }
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
    sortchange.innerHTML = GM_config.fields.sortmode.settings.options[0].toString();
    sortchange.addEventListener("click", function () {
        SortRows(1);
    }, false);
    var sortchange2 = document.createElement('div');
    sortchange2.id = 'sortchange2';
    sortchange2.innerHTML = GM_config.fields.sortmode.settings.options[1].toString();
    sortchange2.addEventListener("click", function () {
        SortRows(2);
    }, false);
    var sortchange3 = document.createElement('div');
    sortchange3.id = 'sortchange3';
    sortchange3.innerHTML = GM_config.fields.sortmode.settings.options[2].toString();
    sortchange3.addEventListener("click", function () {
        SortRows(3);
    }, false);
    var sortchange4 = document.createElement('div');
    sortchange4.id = 'sortchange4';
    sortchange4.innerHTML = GM_config.fields.sortmode.settings.options[3].toString();
    sortchange4.addEventListener("click", function () {
        SortRows(4);
    }, false);
    var sortchange5 = document.createElement('label');
    sortchange5.id = 'sortchange5';
    sortchange5.innerHTML = GM_config.fields.sortmode.settings.options[4].toString() + ': ';
    var sortchange5t = document.createElement('input');
    sortchange5t.id = 'sortchange5t';
    sortchange5t.addEventListener("input", function () {
        SortRows(5);
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

async function docalctotal(itempageprice){
    let itempageshipping;
    if(!itemsunsafewindowmode){
        itempageshipping = document.querySelector('.product-shipping-price') || document.querySelector('.dynamic-shipping-titleLayout');
        if(itempageshipping){
            itempageshipping = itempageshipping.innerText;
            if(itempageshipping.indexOf('Free Shipping') != -1){
                itempageshipping = '0.00';
            }
            itempageshipping = parseFloat(itempageshipping.substring(itempageshipping.indexOf('$')+1).trimEnd());
        }
    }
    else{
        let runparams = await getParams();
        itempageshipping = getPriceFromParams(runparams.data);
    }
    if(itempageprice.indexOf('-') != -1){
        itempageprice = itempageprice.substring(0, itempageprice.indexOf('-')-1);
    }
    let preprice = itempageprice.substring(itempageprice.indexOf(':')+1, itempageprice.indexOf('$')+1);
    itempageprice = parseFloat(itempageprice.substring(itempageprice.indexOf('$')+1).trimEnd());
    let itempagetotal = parseFloat(itempageshipping + itempageprice).toFixed(2).toString();
    let finalcostpretext = document.createElement('span');
    finalcostpretext.className = 'total-pretext';
    finalcostpretext.innerHTML = "Total: " + preprice + itempagetotal;
    finalcostpretext.style.fontSize = "24px";
    finalcostpretext.style.fontWeight = "700";
    let finalcostdiv = document.createElement('div');
    finalcostdiv.className = 'total-current';
    finalcostdiv.appendChild(finalcostpretext);
    let insertitemtotal = document.querySelector('.product-action');
    if(insertitemtotal){
        let pretextitem = document.querySelector('.product-info').querySelector('.total-pretext');
        if(pretextitem){
            pretextitem.innerHTML = "Total: " + preprice + itempagetotal;
        }
        else{
            insertitemtotal.parentNode.insertBefore(finalcostdiv, insertitemtotal);
        }
        if(!document.getElementById('wishlist-tbody')){
            finalwishliststart(itempagetotal);
        }
    }
}

function appendpricestoitemproperties(propitem, pricelistitem, pretext = ""){
    let proptxt;
    if(pricelistitem.skuVal.skuActivityAmount){
        proptxt = pretext + "$" + pricelistitem.skuVal.skuActivityAmount.value + "";
    }
    else{
        proptxt = pretext + "$" + pricelistitem.skuVal.skuMultiCurrencyDisplayPrice + "";
    }
    if(propitem.innerText.indexOf(proptxt) == -1){
        let propdiv;
        if(pretext != ""){
            if(!propitem.querySelector('.sku-property-text3') && !propitem.querySelector('.sku-property-text2')){
                propdiv = document.createElement('div');
                propdiv.className = 'sku-property-text3';
            }
            else{
                propdiv = propitem.querySelector('.sku-property-text3');
                if(propdiv){
                    if(propdiv.childNodes.length > 2){
                        propdiv.className = 'sku-property-text2';
                    }
                }
                else{
                    propdiv = propitem.querySelector('.sku-property-text2');
                }
            }
        }
        else{
            propdiv = document.createElement('div');
            propdiv.className = 'sku-property-text';
        }
        let propspan = document.createElement('span');
        propspan.style = "display: block";
        propspan.innerHTML = proptxt;
        propdiv.appendChild(propspan);
        if(!propitem.querySelector('.sku-property-text3') && !propitem.querySelector('.sku-property-text2')){
            propitem.appendChild(propdiv);
        }
    }
}

function addpricestoitemproperties(pricelist, propitem){
    for (let i = 0; i < pricelist.skuPriceList.length; i++) {
        let propids = pricelist.skuPriceList[i].skuPropIds.split(",");
        let propnames = [];
        for (let i2 = 0; i2 < propids.length; i2++) {
            let proplist = pricelist.productSKUPropertyList;
            for (let i3 = 0; i3 < proplist.length; i3++) {
                let propvals = proplist[i3].skuPropertyValues;
                for (let i4 = 0; i4 < propvals.length; i4++) {
                    if(propvals[i4].propertyValueId == propids[i2]){
                        propnames.push(propvals[i4].propertyValueDisplayName);
                    }
                }
            }
            for (let i5 = 0; i5 < propnames.length; i5++) {
                if(propnames[i5] == propitem.firstChild.innerText || propnames[i5] == propitem.firstChild.firstChild.title){
                    if(propids.length > 1){
                        if(i5 < propnames.length){
                            let pretextar = propnames.filter(
                                function(val){
                                    return val != propnames[i5];
                                }
                            )
                            if(pretextar.length > 0){
                                let pretext = pretextar.join(' + ') + " = ";
                                appendpricestoitemproperties(propitem, pricelist.skuPriceList[i], pretext);
                            }
                        }
                    }
                    else{
                        appendpricestoitemproperties(propitem, pricelist.skuPriceList[i]);
                        break;
                    }
                }
            }
        }
    }
}

async function calctotal(){
    let itempageprice = document.querySelector('.product-price-value') || document.querySelector('.product-price-current') || document.querySelector('.uniform-banner-box-price');
    let config = { childList: true, subtree: true, characterData: true };
    let observer4 = new MutationObserver(function(mutationsList, observer) {
        for(const mutation of mutationsList) {
            docalctotal(mutation.target.textContent);
        }
    });
    observer4.observe(itempageprice, config);
    let proplist = document.querySelector('.sku-wrap');
    if(proplist && proplist.childNodes.length > 0){
        let runparams = await getParams();
        let pricelist = runparams.data.skuModule;
        let proplistall = proplist.querySelectorAll('.sku-property');
        let docalc = false;
        for (let i = 0; i < proplistall.length; i++) {
            let dofirstclick = (!proplistall[i].querySelector('.sku-title-value') || (proplistall[i].querySelector('.sku-title-value') && proplistall[i].querySelector('.sku-title-value').innerHTML == ""));
            let propitem = proplistall[i].querySelectorAll('.sku-property-item');
            if(propitem && propitem.length > 0){
                let hasclicked = false;
                for (let i2 = 0; i2 < propitem.length; i2++) {
                    if(dofirstclick && !hasclicked && !propitem[i2].classList.contains('selected') && !propitem[i2].classList.contains('disabled')){
                        hasclicked = true;
                        propitem[i2].click();
                    }
                    if(itemsunsafewindowmode){
                        addpricestoitemproperties(pricelist, propitem[i2]);
                    }
                }
            }
            if(!dofirstclick){
                docalc = true;
            }
        }
        if(docalc){
            docalctotal(itempageprice.innerText);
        }
    }
    else{
        docalctotal(itempageprice.innerText);
    }
}

function getshippingdates(){
    let deliverydiv = document.querySelector('.product-shipping-delivery');
    if(deliverydiv){
        let shippingtime = deliverydiv.childNodes[1].innerText;
        let shippingtime1 = shippingtime.split('-');
        let shippingtime2 = shippingtime1[1];
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

function waitForEl3(){
    var observerc = new MutationObserver(function (mutation) {
        if(mutation[0].target.className == 'active') {
            GM_config.open();
            mutation[0].target.className = '';
            return;
        }
    });

    observerc.observe(document.querySelector("#ui-box-title"), {
        attributes: true
    });
}

async function getPageParams(page, cpage=""){
    return new Promise((responseDetails) => {
        let args = document.location.href.substring(document.location.href.indexOf(document.location.pathname) + document.location.pathname.length + 1);
        if(args.indexOf('page=') != -1){
            args = args.replace("page=" + cpage, "page=" + page);
        }
        else{
            args = args + "&page=" + page;
        }
        GM_xmlhttpRequest ( {
            method:     'GET',
            responseType: 'json',
            headers:    {
                Accept:  'application/json, text/plain, */*',
                Referer:  document.location.href
            },
            url:        'https://www.aliexpress.com/glosearch/api/product?' + args,
            onload:     function (response) {
                processall3(JSON.parse(response.responseText));
            }
        } );
    });
}

function setabs(clicked){
    let cpage;
    let cpageel;
    let npage = parseInt(clicked.innerHTML);
    let list2 = document.querySelector('.next-pagination-list').childNodes;
    for (let i2 = 0; i2 < list2.length; i2++) {
        if(list2[i2].classList.contains('next-current')){
            cpage = parseInt(list2[i2].innerHTML);
            list2[i2].classList.remove('next-current');
            if(clicked.innerHTML.indexOf("Next") != -1){
                npage = cpage+1;
                cpageel = list2[i2 + 1];
            }
            else if(clicked.innerHTML.indexOf("Previous") != -1){
                npage = cpage-1;
                cpageel = list2[i2 - 1];
            }
            break;
        }
    }
    let newpage = document.createElement('button');
    newpage.setAttribute('type',"button");
    newpage.setAttribute('role',"button");
    newpage.setAttribute('aria-label', "Page 6, 7 pages");
    newpage.className="next-btn next-medium next-btn-normal next-pagination-item";
    newpage.addEventListener('click', function(e){
        let clicked2 = e.target || e.srcElement;
        setabs(clicked2);
    });
    if(cpage < npage){
        document.querySelector('.next-pagination-list').removeChild(list2[0]);
        newpage.innerHTML = (parseInt(list2[list2.length-1].innerHTML) + 1).toString();
        document.querySelector('.next-pagination-list').append(newpage);
    }
    else{
        document.querySelector('.next-pagination-list').removeChild(list2[list2.length-1]);
        newpage.innerHTML = (parseInt(list2[0].innerHTML) - 1).toString();
        document.querySelector('.next-pagination-list').prepend(newpage);
    }
    if(cpageel){
        cpageel.classList.add('next-current');
    }
    else{
        clicked.classList.add('next-current');
    }
    getPageParams(npage.toString(), cpage.toString());
}

function addpageevent(elem){
    elem.addEventListener('click', function(e){
        let clicked = e.target || e.srcElement;
        setabs(clicked);
    });
}

function turnoffpaginationreload(){
    if(unsafewindowmode == 1){
        let observerd = new MutationObserver(function (mutations) {
            mutations.forEach(function(mutation) {
                if(mutation.type == 'childList'){
                    for (var j = 0; j < mutation.addedNodes.length; j++) {
                        let list = mutation.addedNodes[j].querySelector('.next-pagination-list').childNodes;
                        for (let i = 0; i < list.length; i++) {
                            list[i].outerHTML = list[i].outerHTML;
                            addpageevent(list[i]);
                        }
                        if(mutation.addedNodes[j].querySelector('.next-next')){
                            mutation.addedNodes[j].querySelector('.next-next').outerHTML = mutation.addedNodes[j].querySelector('.next-next').outerHTML;
                            addpageevent(mutation.addedNodes[j].querySelector('.next-next'));
                        }
                        if(mutation.addedNodes[j].querySelector('.next-prev')){
                            mutation.addedNodes[j].querySelector('.next-prev').outerHTML = mutation.addedNodes[j].querySelector('.next-prev').outerHTML;
                            addpageevent(mutation.addedNodes[j].querySelector('.next-prev'));
                        }
                    }
                }
            });
            return;
        });

        observerd.observe(document.querySelector(".list-pagination"), {
            childList: true
        });
    }
    else{
        let observerd = new MutationObserver(function (mutations) {
            mutations.forEach(function(mutation) {
                if(mutation.type == 'childList'){
                    for (var j = 0; j < mutation.addedNodes.length; j++) {
                        let list = mutation.addedNodes[j].querySelector('.next-pagination-list').childNodes;
                        for (let i = 0; i < list.length; i++) {
                            list[i].addEventListener('click', function(e){
                                let clicked = e.target || e.srcElement;
                                if(document.location.href.indexOf('page=') != -1){
                                    let cpage = document.location.href.substring(document.location.href.indexOf('page=')+5);
                                    if(cpage.indexOf('&') != -1){
                                        cpage = cpage.substring(0,cpage.indexOf('&'));
                                    }
                                    document.location.href = document.location.href.replace("page=" + cpage, "page=" + clicked.innerHTML);
                                }
                                else{
                                    document.location.href = document.location.href + "&page=" + clicked.innerHTML;
                                }
                            });
                        }
                        if(mutation.addedNodes[j].querySelector('.next-next')){
                            mutation.addedNodes[j].querySelector('.next-next').addEventListener('click', function(e){
                                let clicked = e.target || e.srcElement;
                                if(document.location.href.indexOf('page=') != -1){
                                    let cpage = document.location.href.substring(document.location.href.indexOf('page=')+5);
                                    if(cpage.indexOf('&') != -1){
                                        cpage = cpage.substring(0,cpage.indexOf('&'));
                                    }
                                    document.location.href = document.location.href.replace("page=" + cpage, "page=" + (parseInt(cpage)+1).toString());
                                }
                                else{
                                    document.location.href = document.location.href + "&page=2";
                                }
                            });
                        }
                        if(mutation.addedNodes[j].querySelector('.next-prev')){
                            mutation.addedNodes[j].querySelector('.next-prev').addEventListener('click', function(e){
                                let clicked = e.target || e.srcElement;
                                let cpage = document.location.href.substring(document.location.href.indexOf('page=')+5);
                                if(cpage.indexOf('&') != -1){
                                    cpage = cpage.substring(0,cpage.indexOf('&'));
                                }
                                document.location.href = document.location.href.replace("page=" + cpage, "page=" + (parseInt(cpage)-1).toString());
                            });
                        }
                    }
                }
            });
            return;
        });

        observerd.observe(document.querySelector(".list-pagination"), {
            childList: true
        });
    }
}

function injecthiddencftrigger(){
    if(document.getElementsByClassName('sort').length > 0){
        let titlediv = document.createElement('div');
        let titletext = document.createElement('span');
        titletext.id = 'ui-box-title';
        titletext.style = 'font-weight: bold; cursor: pointer; padding-left: 20px';
        titletext.innerHTML = 'Configure Aliexpress Plus';
        titletext.addEventListener('click', function(e){
            let clicked = e.target || e.srcElement;
            clicked.classList.add('active');
        });
        titlediv.appendChild(titletext);
        document.getElementsByClassName('sort')[0].firstChild.appendChild(titlediv);
        waitForEl3();
        GM_registerMenuCommand("Configure", function (){document.querySelector("#ui-box-title").className = "active";});
    }
}

if(document.location.href.indexOf('/wholesale') != -1 || document.location.href.indexOf('/category') != -1 || document.location.href.indexOf('/af') != -1){
    injecthiddencftrigger();
    if(unsafewindowmode == 1){
        processall3();
    }
    else{
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
        fakeScrollDown();
    }
    insertsearch();
    turnoffpaginationreload();
}
else if(document.location.href.indexOf('/item') != -1){
    waitForEl2();
    setTimeout((function(){
        checkall(document.querySelectorAll(".item-info"));
        calctotal();
        getshippingdates();
    }),2000);
}
