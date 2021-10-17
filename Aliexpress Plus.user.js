// ==UserScript==
// @name         Aliexpress Plus
// @namespace    http://www.facebook.com/Tophness
// @version      3.0.0
// @description  Sorts search results by item price properly with shipping costs included, enhances item pages
// @author       Tophness
// @match        https://*.aliexpress.com/w/wholesale*
// @match        https://*.aliexpress.com/wholesale*
// @match        https://*.aliexpress.com/category*
// @match        https://*.aliexpress.com/af/*
// @match        https://*.aliexpress.com/item/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/tinysort/2.3.6/tinysort.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/tinysort/2.3.6/tinysort.charorder.min.js
// @require      https://userscripts-mirror.org/scripts/source/107941.user.js
// @require      http://rembrandtjs.com/javascripts/browser.min.js
// @require      https://openuserjs.org/src/libs/sizzle/GM_config.min.js
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

GM_config.init(
    {
        'id': 'Config',
        title: 'Configure',
        'fields': {
            'sortmethod': {
                label: 'Search: Sort Mode',
                type: 'select',
                options: ['Cheapest Unit Price','Cheapest Total Price','Cheapest Total Price (Max Price)','Cheapest Price','Max Price' ],
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
                type: 'text',
                default: '0.8'
            },
            'filterNamesFromImgs': {
                label: 'Wishlist: Remove Results Found In Text Search From Image Search',
                type: 'checkbox',
                default: true
            },
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
var similarityratio = parseFloat(GM_config.get('similarity'));
var sortmethod = GM_config.get('sortmethod');
var pagesearch = GM_config.get('pagesearch');

GM_registerMenuCommand("Configure", () => GM_config.open());
GM_addStyle(".tabs{overflow:hidden;clear:both;} .tabs ul{list-style-type:none;bottom: -1px;position:relative;} .tabs li{float:left;} .tablist span{cursor: pointer;display:block;padding:5px 10px;text-decoration: none;margin: 0 4px;border-top:1px solid #CCC;border-left:1px solid #DDD;border-right:1px solid #DDD;font:13px/18px verdana,arial,sans-serif;border-bottom:1px solid #CCC;} .tablist span.exact{background-color: red;color: #fff;} .tablist span.containstext{background-color: blue;color: #fff;} .tablist span.relative{background-color: green;color: #fff;} .tablist span.images{background-color: yellow;color: #000;} .tablist span.active{background-color: #eee;color: #000;border-bottom:1px solid #fff;}");

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

function htmlToElements(html) {
    let template = document.createElement('template');
    template.innerHTML = html;
    return template.content;
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
                        let didpass = await imgTest(imgschild[i], base64toBlob(ordersclone[i2].imgs[i3].replace("data:image/webp;base64,","")));
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
            let imgsall = mainel.getElementsByClassName('images-view-list')[0].childNodes;
            let imgsblob = [];
            let imgschild = [];
            if(UseSideImgs){
                for (let i4 = 0; i4 < imgsall.length; i4++) {
                    if(UseB64Imgs){
                        let base64Img = await convertImgToBase64URL(imgsall[i4].firstChild.firstChild.src);
                        imgschild.push(base64Img[0]);
                        imgsblob.push(base64Img[1]);
                    }
                    else{
                        imgschild.push(imgsall[i4].firstChild.firstChild.src.replace("_.webp",""));
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
                        imgschild.push(imgsall2[i5].firstChild.firstChild.src.replace("_.webp",""));
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
                el : cloneEl.innerHTML
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
                title.class = 'ui-box-title';
                title.innerHTML = 'Similar Wishlist Items';
                wishb.id = 'wishlist-tbody';
                wishb.setAttribute('style', 'align:top;position:absolute;width:18%');
                document.getElementById('header').appendChild(title);
                document.getElementById('header').appendChild(wishb);
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
        document.getElementById('sortchange' + (GM_config.fields.sortmethod.settings.options.indexOf(sortmethod)+1).toString()).setAttribute('style', 'font-weight: bold');
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

if(document.location.href.indexOf('/wholesale') != -1 || document.location.href.indexOf('/category') != -1 || document.location.href.indexOf('/af') != -1){
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
