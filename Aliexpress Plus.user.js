// ==UserScript==
// @name         Aliexpress Plus
// @namespace    http://www.facebook.com/Tophness
// @version      2.3.2
// @description  Sorts search results by item price properly with shipping costs included, enhances item pages
// @author       Tophness
// @match        https://*aliexpress.com/wholesale?*
// @match        https://*aliexpress.com/item/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/tinysort/2.3.6/tinysort.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/tinysort/2.3.6/tinysort.charorder.min.js
// @license MIT
// @run-at document-idle
// ==/UserScript==

var sortmethod = 2;
var count = 0;

var elh = {
    'sortchange1' : 'Cheapest Unit Price',
    'sortchange2' : 'Cheapest Total Price',
    'sortchange3' : 'Cheapest Total Price (Max Price)',
    'sortchange4' : 'Cheapest Price',
    'sortchange5' : 'Max Price',
};

var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        if(mutation.type == 'childList'){
            for (var j = 0; j < mutation.addedNodes.length; j++) {
                processall(mutation.addedNodes[j].childNodes);
            }
        }
    });
});

function waitForEl(){
    var observera = new MutationObserver(function (mutations, me) {
        if(document.querySelector("ul.list-items")) {
            me.disconnect();
            if(document.location.href.indexOf('g=y') == -1){
                observer.observe(document.querySelector("ul.list-items"), { childList: true, subtree: true });
            }
            else{
                observer.observe(document.querySelector("ul.list-items"), { childList: true });
            }
            return;
        }
    });

    observera.observe(document, {
        childList: true,
        subtree: true
    });
}

function process(listitem){
    if(listitem.querySelector){
        var pricerow = listitem.querySelector('div.item-price-row');
        if(pricerow){
            var price = pricerow.querySelector('.price-current');
            var shipping = listitem.querySelector('.shipping-value');
            if(price && price.innerText.indexOf('$') != -1 && listitem.className != "moved" && listitem.className.indexOf('product-card') == -1){
                var pricefixed = price.innerText.substring(price.innerText.indexOf('$')+1);
                var shippingfixed;
                if(shipping.innerText.indexOf('Free Shipping') == -1){
                    shippingfixed = shipping.innerText.substring(shipping.innerText.indexOf('$')+1);
                }
                else{
                    shippingfixed = "0.00";
                }
                var pricepretext = price.innerText.substring(0, price.innerText.indexOf('$')+1);
                var finalcost = "";
                var pricesplit;
                if(pricefixed.indexOf(' - ') != -1){
                    pricesplit = pricefixed.split(' - ');
                    if(sortmethod == 3){
                        finalcost = (parseFloat(pricesplit[1]) + parseFloat(shippingfixed)).toFixed(2) + " - " + (parseFloat(pricesplit[0]) + parseFloat(shippingfixed)).toFixed(2);
                    }
                    else{
                        finalcost = (parseFloat(pricesplit[0]) + parseFloat(shippingfixed)).toFixed(2) + " - " + (parseFloat(pricesplit[1]) + parseFloat(shippingfixed)).toFixed(2);
                    }
                }
                else{
                    finalcost = (parseFloat(pricefixed) + parseFloat(shippingfixed)).toFixed(2);
                }
                var finalcostpost;
                var finalcostpostwhole;
                var priceunitparttemp;
                var priceunitel = pricerow.querySelector('span.price-unit');
                if(pricerow.classList.contains('item-big-promotion')){
                    priceunitel = listitem.querySelector('div.item-price-row.packaging-sale');
                    if(priceunitel){
                        priceunitel = priceunitel.querySelector('span.price-unit');
                    }
                }
                if(priceunitel){
                    var priceuniteltext = priceunitel.innerText;
                    var priceunit = priceuniteltext.substring(0, priceuniteltext.indexOf(' '));
                    var priceunitposttext = priceuniteltext.substring(priceuniteltext.indexOf(' '));
                    var finalcostpart;
                    if(pricefixed.indexOf(' - ') != -1){
                        if(sortmethod == 3){
                            finalcostpart = (parseFloat(pricesplit[1]).toFixed(2) / parseFloat(priceunit)).toFixed(2);
                        }
                        else{
                            finalcostpart = (parseFloat(pricesplit[0]).toFixed(2) / parseFloat(priceunit)).toFixed(2);
                        }
                    }
                    else{
                        finalcostpart = (finalcost / parseFloat(priceunit)).toFixed(2);
                    }
                    if(priceunitposttext.indexOf('/') != -1){
                        var priceunitsplit = priceunitposttext.split('/');
                        var priceunitpart = priceunitsplit[0];
                        var priceunitwhole = priceunitsplit[1];
                        finalcostpostwhole = finalcost + " / " + priceunitwhole;
                        finalcost = finalcostpart + " / " + priceunitpart;
                        priceunitparttemp = priceunitpart;
                    }
                }
                var finalcostdiv = document.createElement('div');
                finalcostdiv.className = 'item-total-wrap';
                if(finalcostpostwhole){
                    var finalcostpretext = document.createElement('span');
                    finalcostpretext.className = 'total-pretext';
                    finalcostpretext.innerHTML = "Total: " + pricepretext;
                    var finalcostspan = document.createElement('span');
                    finalcostspan.className = 'total-current';
                    finalcostspan.innerHTML = finalcostpostwhole;
                    if(pricerow.classList.contains('item-big-promotion')){
                        pricerow.querySelector('span.price-unit').innerHTML = " / " + priceunitparttemp;
                    }
                    else{
                        listitem.querySelector('div.item-price-row.packaging-sale').querySelector('span.price-unit').innerHTML = " / " + priceunitparttemp;
                    }
                    price.innerHTML = pricepretext + finalcostpart;
                    finalcostdiv.appendChild(finalcostpretext);
                    if(sortmethod == 0){
                        finalcostspan.className = 'total-posttext';
                        var finalcostbr = document.createElement('br');
                        finalcostbr.style.display = "none";
                        var finalcostspan2 = document.createElement('span');
                        finalcostspan2.className = 'total-current';
                        finalcostspan2.innerHTML = finalcost;
                        finalcostspan2.style.display = "none";
                        finalcostdiv.appendChild(finalcostspan2);
                        finalcostdiv.appendChild(finalcostbr);
                    }
                    finalcostdiv.appendChild(finalcostspan);
                }
                else{
                    var finalcostpretext = document.createElement('span');
                    finalcostpretext.className = 'total-pretext';
                    finalcostpretext.innerHTML = "Total: " + pricepretext;
                    var finalcostspan = document.createElement('span');
                    finalcostspan.className = 'total-current';
                    finalcostspan.innerHTML = finalcost;
                    finalcostdiv.appendChild(finalcostpretext);
                    finalcostdiv.appendChild(finalcostspan);
                }
                if(shipping.parentNode.nextSibling.className != finalcostdiv.className){
                    price.parentNode.parentNode.parentNode.insertBefore(finalcostdiv, shipping.parentNode.nextSibling);
                }
                if(count >= 3){
                    sortall(document.querySelectorAll("li.list-item"));
                    count = 0;
                }
                else{
                    count++;
                }
            }
        }
    }
}

function processall(list){
    for (var i = 0; i < list.length; i++) {
        process(list[i]);
    }
}

function sortall(listitems){
    if(sortmethod == 0){
        tinysort(listitems,{selector:'span.total-current', natural:true});
    }
    else if(sortmethod == 1){
        tinysort(listitems,{selector:'span.total-current', natural:true});
    }
    else if(sortmethod == 2){
        tinysort(listitems,{selector:'span.price-current', natural:true});
    }
    if(sortmethod == 3){
        tinysort(listitems,{selector:'span.total-current', natural:true});
    }
    else if(sortmethod == 4){
        tinysort(listitems,{selector:'span.price-current', natural:true, order: 'desc'});
    }
}

function SortRows(mode){
    sortmethod = mode;
    sortall(document.querySelectorAll("li.list-item"));
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
    sortchange.innerHTML = elh[sortchange.id];
    sortchange.addEventListener("click", function () {
        SortRows(0)
    }, false);
    var sortchange2 = document.createElement('div');
    sortchange2.id = 'sortchange2';
    sortchange2.innerHTML = elh[sortchange2.id];
    sortchange2.addEventListener("click", function () {
        SortRows(1)
    }, false);
    var sortchange3 = document.createElement('div');
    sortchange3.id = 'sortchange3';
    sortchange3.innerHTML = elh[sortchange3.id];
    sortchange3.addEventListener("click", function () {
        SortRows(2)
    }, false);
    var sortchange4 = document.createElement('div');
    sortchange4.id = 'sortchange4';
    sortchange4.innerHTML = elh[sortchange4.id];
    sortchange4.addEventListener("click", function () {
        SortRows(3)
    }, false);
    var sortchange5 = document.createElement('label');
    sortchange5.id = 'sortchange5';
    sortchange5.innerHTML = elh[sortchange5.id] + ': ';
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
        document.getElementById('sortchange' + (sortmethod)).setAttribute('style', 'font-weight: bold');
    }
}

function process2(item){
    if(item.className == "item-info"){
        if(item.querySelector("div.item-title.line-limit-length")){
            item.querySelector("div.item-title.line-limit-length").classList.remove('line-limit-length');
            //item.parentNode.parentNode.style.marginBottom = "88px";
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
    var observera = new MutationObserver(function (mutations, me) {
        if(document.querySelector(".item-title-block")) {
            me.disconnect();
            observer2.observe(document.querySelector(".bottom-recommendation"), { childList: true, subtree: true });
            return;
        }
    });

    observera.observe(document, {
        childList: true,
        subtree: true
    });
}

if(document.location.href.indexOf('https://www.aliexpress.com/wholesale') != -1){
    waitForEl();
    processall(document.querySelectorAll("li.list-item"));
    //sortall(document.querySelectorAll("li.list-item"));
    insertsearch();
}
else if(document.location.href.indexOf('https://www.aliexpress.com/item') != -1){
    waitForEl2();
    setTimeout((function(){
        checkall(document.querySelectorAll(".item-info"));
    }),5000);
}
