// ==UserScript==
// @name        Aliexpress Plus
// @namespace   http://www.facebook.com/Tophness
// @description Sorts search results by item price properly with shipping costs included, Lets you search your wishlish, Shows related wishlist items in search and item pages, Adds search default options.
// @include     http://*aliexpress.com/wishlist*
// @include     http://*alibaba.com/wishlist*
// @include     http://*aliexpress.com/*
// @include     https://*aliexpress.com/wishlist*
// @include     https://*alibaba.com/wishlist*
// @include     https://*aliexpress.com/*
// @exclude	http://www.aliexpress.com/w/wholesale-*.html
// @exclude	http://www.aliexpress.com/category/*.html*
// @require	http://code.jquery.com/jquery-1.11.0.js
// @exclude	https://www.aliexpress.com/w/wholesale-*.html
// @exclude	https://www.aliexpress.com/category/*.html*
// @require	https://code.jquery.com/jquery-1.11.0.js
// @require     https://greasyfork.org/scripts/6217-gm-config/code/GM_config.js?version=23537
// @version     1.6.9
// @grant   GM_getValue
// @grant   GM_setValue
// @grant   GM_log
// @grant   GM_registerMenuCommand
// @noframes
// ==/UserScript==

var jqver = "1.11.0";

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

function getMatches(string, regex, index) {
	index || (index = 1);
	var matches = [];
	var match;
	while (match = regex.exec(string)) {
		matches.push(match[index]);
	}
	return matches;
}

function GM_main($) {
	var dsmode = 2;
	var iccats = ["4099", "400103"];
	var desc = document.getElementsByClassName('ui-box-body')[1].innerHTML;
	var tit = document.getElementsByClassName('product-name')[0].innerHTML;
	var myRegEx = /(\b[a-z0-9]+[a-z0-9-]+[a-z0-9]\b)+(?:[\w|\s])+(\b[a-z0-9]+[a-z0-9-]+[a-z0-9]\b)(?:$|\w)/i;
	if (myRegEx.test(tit)) {
		var matches = myRegEx.exec(tit)[1];
		if (desc && $.inArray(window.runParams.categoryId, iccats) != -1) {
			if (desc.indexOf(tit) == -1 || desc.indexOf('Shipment') == 0) {
				if (dsmode == 1) {
					var url = "http://octopart.com/api/v3/parts/search";
					url += "?callback=?";
					url += "&apikey=f1ceb286";
					var args = {
						q : tit,
						start : 0,
						limit : 2
					};
					$.getJSON(url, args, function (search_response) {
						var newdesc = "";
						$.each(search_response['results'], function (i, result) {
							var part = result['item'];
							newdesc += part['brand']['name'] + ' - ' + part['mpn'] + '<br>';
							if (part['descriptions']) {
								newdesc += part['descriptions']['value'] + '<br>';
							}
							if (part['specs']) {
								newdesc += part['specs'] + '<br>';
							}
							if (part['snippet']) {
								newdesc += part['snippet'] + '<br>';
							}
							if (part['product_url']) {
								newdesc += part['product_url'] + '<br>';
							}
							if (part['octopart_rfq_url']) {
								newdesc += part['octopart_rfq_url'] + '<br>';
							}
						});
						document.getElementsByClassName('ui-box-body')[1].innerHTML = newdesc;
					});
				}
			}
			if (dsmode == 2) {
				$.ajaxSetup({
					scriptCharset : "utf-8", //or "ISO-8859-1"
					contentType : "application/json; charset=utf-8"
				});

				$.getJSON('http://anyorigin.com/get?url=' +
					encodeURIComponent("http://distributor.alldatasheet.com/view.jsp?Searchword=" + matches) + '&callback=?',
					function (data) {
					$("#relate-product-by-keywords").append($(data.contents).find("tbody:nth-child(1)").get(7).innerHTML);
				});
			}
		}
	}
}

function add_jQuery(callbackFn, jqVersion) {
	var jqVersion = jqVersion || jqver;
	var D = document;
	var targ = D.getElementsByTagName('head')[0] || D.body || D.documentElement;
	var scriptNode = D.createElement('script');
	scriptNode.src = 'http://code.jquery.com/jquery-'
		 + jqVersion
		 + '.js';
	scriptNode.addEventListener("load", function () {
		var scriptNode = D.createElement("script");
		scriptNode.textContent =
			'var gm_jQuery  = jQuery.noConflict (true);\n'
			 + '(' + callbackFn.toString() + ')(gm_jQuery);';
		targ.appendChild(scriptNode);
	}, false);
	targ.appendChild(scriptNode);
}

var orders = new Array();
var cstoken = '';
var doneLoading = 0;
var currentPage = 1;
var ListingRanks = new Array();
var ListingsRows = [];
var price = /\$([\d\,]*.\d\d)/;
var elh = {
	'sortchange' : 'Cheapest Unit Price',
	'sortchange2' : 'Cheapest Price',
	'sortchange3' : 'Total Price',
	'sortchange4l' : 'Max Price'
};
var searchel = document.getElementById('form-search') || document.getElementById('form-searchbar');
var uls;
var args = {
	SortType : ["price_asc", "price_dsc"],
	groupsort : ["0", "1"],
	CatId : ["0"],
	ltype : ["wholesale"],
	isUnitPrice : ["y", "n"],
	minQuantity : ["", "0", "1", "2", "5", "10", "20", "50", "100", "200"],
	maxQuantity : ["", "0", "1", "2", "5", "10", "20", "50", "100", "200"],
	isFreeShip : ["", "y", "n"]
};
var frame = document.createElement('div');
document.body.appendChild(frame);
var fields = {
	'Mode' : {
		'label' : 'Wishlist Search Mode',
		'type' : 'select',
		'options' : ['Relative', 'Contains Text', 'Exact'],
		'default' : 'Contains Text'
	}
};
if (searchel) {
	getsrcvars();
}

GM_config.init({
	'id' : 'GM_config',
	'fields' : fields,
	'frame' : frame
});

if (searchel) {
	for (key in args) {
		//if(document.getElementsByName(key)[0] != undefined){
		//	document.getElementsByName(key)[0].value = GM_config.get(key);
		//}
		//else{
		var extras = document.createElement('input');
		extras.type = 'hidden';
		extras.name = key;
		extras.value = GM_config.get(key);
		searchel.appendChild(extras);
		//}
	}
	try {
		uls = document.getElementById('list-items') || document.getElementById('hs-below-list-items') || document.getElementById('hs-list-items');
	} catch (e) {}
	FindAllRows();
}

GM_registerMenuCommand('Aliexpress Plus Options', opengmcf);

function getsrcvars() {
	for (key in args) {
		fields[key] = {
			'label' : key,
			'type' : 'select',
			'options' : args[key],
			'default' : args[key][0]
		};
	}
}

function opengmcf() {
	GM_config.open();
}

function grabOrders(doc) {
	var tags = doc.getElementsByTagName('tbody')[0].getElementsByTagName('tr');
	for (var i = 0; i < tags.length; i++) {
		var oblink;
		var obprice;
		var ob;
		try {
			ob = tags[i].getElementsByClassName('main-info-hd')[0].getElementsByTagName('a')[0];
			oblink = ob.href;
			obprice = tags[i].getElementsByClassName('price price-m')[0].getElementsByClassName('value')[0].textContent.replace(/\s+/g, "").replace("$", "");
			//obprice = obprice.substring(obprice.indexOf('$') + 1);
			//obprice = obprice.substring(0, obprice.indexOf('/') - 1);
			obtitle = ob.innerHTML;
		} catch (e) {}
		if (oblink) {
			orders.push({
				title : obtitle,
				price : obprice,
				href : oblink,
				el : escape(tags[i].innerHTML.toString().replace("http://img.alibaba.com/images/eng/wholesale/icon/nophoto.gif", "").replace("img-src", "src").replace("image-src", "src").replace("/v1/", "/v2/"))
			});
		}
	}

	tags = doc.getElementsByTagName('input');
	for (var i = 0; i < tags.length; i++) {
		if (tags[i].name.startsWith('_csrf_token')) {
			cstoken = tags[i].value;
			break;
		}
	}
}

function loadAPage() {
	var parameters = "_csrf_token=" + cstoken + "&page=" + currentPage;
	page_request.open('POST', 'wish_list_product_list.htm?rand=' + Math.random(), true);
	page_request.setRequestHeader("Content-type", "application/x-www-form-urlencoded");

	page_request.send(parameters);
}

(function () {
	var default_floor = 0.5;

	function pairs(str) {
		var pairs = [],
		length = str.length - 1,
		pair;
		for (var i = 0; i < length; i++) {
			pair = str.substr(i, 2);
			if (!/\s/.test(pair)) {
				pairs.push(pair);
			}
		}
		return pairs;
	}

	function similarity(pairs1, pairs2) {
		var union = pairs1.length + pairs2.length,
		hits = 0;

		for (var i = 0; i < pairs1.length; i++) {
			for (var j = 0; j < pairs1.length; j++) {
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
		var str1 = this,
		pairs1 = pairs(this);

		floor = typeof floor == 'number' ? floor : default_floor;

		if (typeof(strings) == 'string') {
			return str1.length > 1 && strings.length > 1 && similarity(pairs1, pairs(strings)) >= floor || str1 == strings;
		} else if (strings instanceof Array) {
			var scores = {};

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
	var newarr = [];
	for (var i = 0; i < arr.length; i++) {
		newarr.push(arr[i].title);
	}
	return newarr;
}

function searchfunc(q, similarity) {
	var qval = q.fuzzy(ulist, similarity);
	if (qval.length > 0) {
		return qval;
	} else {
		return false;
	}
}

function searchin(q) {
	var qval = [];
	for (var i = 0; i < ulist.length; i++) {
		if (ulist[i].indexOf(q) != -1) {
			qval.push(i);
		}
	}
	if (qval.length > 0) {
		return qval;
	} else {
		return false;
	}
}

function search(mode = '', rel = 0.7) {
	var q = document.getElementById('q').value.toLowerCase();
	if (mode == '') {
		mode = GM_config.get('Mode');
	}
	if (!window.orders) {
		//window.orders = wishdata;
		window.orders = JSON.parse(document.getElementById('qh').value);
		document.getElementById('qh').value = "";
	}
	if (!window.ulist) {
		//window.ulist = lookup(orders);
		window.ulist = JSON.parse(document.getElementById('qh2').value);
		document.getElementById('qh2').value = "";
	}
	if (mode == 'Exact') {
		var sq = window.ulist[q];
		if (window.ulist.indexOf(sq) != -1) {
			document.getElementById('wishlist-tbody').innerHTML = "";
			document.getElementById('wishlist-tbody').innerHTML = document.getElementById('wishlist-tbody').innerHTML + unescape(window.orders[sq].el);
		} else {
			document.getElementById('wishlist-tbody').innerHTML = "No results found.";
		}
	} else if (mode == 'Contains Text') {
		var sq = searchin(q);
		if (sq) {
			document.getElementById('wishlist-tbody').innerHTML = "";
			for (var i = 0; i < window.ulist.length; i++) {
				if (window.ulist[i].indexOf(q) != -1) {
					document.getElementById('wishlist-tbody').innerHTML = document.getElementById('wishlist-tbody').innerHTML + unescape(window.orders[i].el);
				}
			}
		} else {
			document.getElementById('wishlist-tbody').innerHTML = "No results found.";
		}
	} else if (mode == 'Relative') {
		var sq = searchfunc(q, rel);
		if (sq) {
			document.getElementById('wishlist-tbody').innerHTML = "";
			for (var i = 0; i < sq.length; i++) {
				document.getElementById('wishlist-tbody').innerHTML = document.getElementById('wishlist-tbody').innerHTML + unescape(window.orders[window.ulist.indexOf(sq[i])].el);
			}
		} else {
			document.getElementById('wishlist-tbody').innerHTML = "No results found.";
		}
	}
}

function loadsearch() {
	document.getElementById('qt').innerHTML = 'Loading search data.. please wait...';
	document.getElementById('qh').value = GM_getValue('wishdata');
	document.getElementById('qh2').value = GM_getValue('titledata');
	document.getElementById('qb').removeAttribute("disabled");
	document.getElementById('q').removeAttribute("disabled");
	document.getElementById('qb').addEventListener("click", function () {
		search()
	}, false);
	document.getElementById('qt').innerHTML = 'Search Wishlist: ';
}

function finalProcessing() {
	document.getElementById('qt').innerHTML = 'Saving wishlist data.. please wait.';
	for (var i = 0; i < orders.length; ++i) {
		orders.sort(function (a, b) {
			return a.price - b.price;
		});
	}
	GM_setValue('wishdata', JSON.stringify(orders));
	document.getElementById('qt').innerHTML = 'Saved wishlist data.';
	GM_setValue('titledata', JSON.stringify(lookup(orders)).toLowerCase());
	document.getElementById('qt').innerHTML = 'Saved wishlist title data.';
	loadsearch();
}

function FindAllRows() {
	var allElements = document.getElementsByTagName('li');
	for (var i = 0; i < allElements.length; ++i) {
		if (allElements[i].className.indexOf('list-item') != -1) {
			ListingsRows.push(allElements[i]);
		}
	}

	total = ListingsRows.length;
	if (ListingsRows.length > 0) {
		for (var i = 0; i < ListingsRows.length; ++i) {
			WorkOnRow(ListingsRows[i]);
		}
		SortRows(0);
		SortRows(1);
		var sortdiv = document.createElement('div');
		sortdiv.className = 'narrow-down-bg';
		var sortspan = document.createElement('div');
		sortspan.className = 'narrow-down-bg';
		var sortspan2 = document.createElement('div');
		sortspan2.className = 'narrow-down-bg';
		var sortspan3 = document.createElement('div');
		sortspan3.className = 'narrow-down-bg';
		var sortspan4 = document.createElement('div');
		sortspan4.className = 'narrow-down-bg';
		var sortchange = document.createElement('a');
		sortchange.id = 'sortchange';
		sortchange.innerHTML = elh[sortchange.id];
		sortchange.addEventListener("click", function () {
			SortRows(1, this)
		}, false);
		var sortchange2 = document.createElement('a');
		sortchange2.id = 'sortchange2';
		sortchange2.innerHTML = elh[sortchange2.id];
		sortchange2.addEventListener("click", function () {
			SortRows(0, this)
		}, false);
		var sortchange3 = document.createElement('a');
		sortchange3.id = 'sortchange3';
		sortchange3.innerHTML = elh[sortchange3.id];
		sortchange3.addEventListener("click", function () {
			SortRows(2, this)
		}, false);
		var sortchange4l = document.createElement('label');
		sortchange4l.id = 'sortchange4l';
		sortchange4l.innerHTML = elh[sortchange4l.id] + ': ';
		var sortchange4t = document.createElement('input');
		sortchange4t.id = 'sortchange4t';
		//for (key in elh) {
		//	eval(key + ".id = '" + elh[key] + "';");
		//}
		sortspan2.appendChild(sortchange2);
		sortspan.appendChild(sortchange);
		sortspan3.appendChild(sortchange3);
		sortspan4.appendChild(sortchange4l);
		sortspan4.appendChild(sortchange4t);
		sortdiv.appendChild(sortspan2);
		sortdiv.appendChild(sortspan);
		sortdiv.appendChild(sortspan3);
		sortdiv.appendChild(sortspan4);
		uls.appendChild(document.createElement('br'));
		uls.appendChild(document.createElement('br'));
		document.getElementById('view-filter').appendChild(sortdiv);
		document.getElementById('sortchange').setAttribute('style', 'font-weight: bold');
	}
}

function SortRows(SortMode, elem = null) {
	if (arguments.length > 1) {
		var butar = ['sortchange', 'sortchange2', 'sortchange3'];
		for (var i = 0; i < butar.length; i++) {
			document.getElementById(butar[i]).setAttribute('style', 'font-weight: none');
		}
		elem.setAttribute('style', 'font-weight: bold');
	}
	uls.innerHTML = "";
	setTimeout(function () {
		insertItems(SortMode)
	}, 100);
}

function updatecheapest(elchange) {
	var uns = ListingRanks[0].units;
	if (uns == 0) {
		uns = 1;
	}
	var prcs = (ListingRanks[0].price * uns).toFixed(2);
	//if(elh[elchange.id]){
	elchange.innerHTML = elh[elchange.id] + ' ($' + prcs + ' for ' + uns + ')';
	//}
}

function insertItems(SortMode) {
	if (SortMode == 0) {
		ListingRanks.sort(function (a, b) {
			return a.price - b.price;
		});
		updatecheapest(document.getElementById('sortchange'));
		ListingRanks.sort(function (a, b) {
			return a.units - b.units;
		});
		updatecheapest(document.getElementById('sortchange2'));
	} else if (SortMode == 1) {
		ListingRanks.sort(function (a, b) {
			return a.units - b.units;
		});
		ListingRanks.sort(function (a, b) {
			return a.price - b.price;
		});
	} else if (SortMode == 2) {
		ListingRanks.sort(function (a, b) {
			return a.units - b.units;
		});
		ListingRanks.sort(function (a, b) {
			return a.totalprice - b.totalprice;
		});
	}
	var maxprice = document.getElementById('sortchange4t').value;
	if (maxprice != "") {
		for (var nj = 0; nj < ListingRanks.length; nj++) {
			if (ListingRanks[nj].totalprice < parseFloat(maxprice)) {
				uls.appendChild(ListingRanks[nj].el);
			}
		}
	} else {
		for (var nj = 0; nj < ListingRanks.length; nj++) {
			uls.appendChild(ListingRanks[nj].el);
		}
	}
}

function WorkOnRow(RowElement) {
	var buyItNowPrice = -1;
	var buyItNowPriceB = -1;
	var shippingPrice = -1;
	var buyItNow;
	var buyItNowB;
	var shipping;
	var unitPrice = 0;
	var shiptext;
	var shipsep;
	var allElements = RowElement.getElementsByTagName('div');

	for (var i = 0; i < allElements.length; ++i) {
		if (allElements[i].className.indexOf("infoprice") != -1) {
			if (allElements[i].innerHTML.indexOf('class="original-price') != -1) {
				allElements[i].removeChild(allElements[i].getElementsByClassName('original-price')[0]);
			}
			var spans = allElements[i].getElementsByTagName('span');
			if (spans.length > 0) {
				for (var j = 0; j < spans.length; ++j) {
					if (spans[j].className.indexOf('lot-price') != -1) {
						buyItNowB = spans[j].getElementsByClassName('value')[0];
						if (spans[j].getElementsByClassName('unit').length > 0) {
							unitPrice = spans[j].getElementsByClassName('unit')[0].textContent;
							unitPrice = unitPrice.substring(unitPrice.indexOf('(') + 1);
							unitPrice = unitPrice.substring(0, unitPrice.indexOf(' '));
							unitPrice = parseFloat(unitPrice);
							var tc = buyItNowB.textContent;
							buyItNowPriceB = tc.match(price)[1].replace(',', '');
						}
					} else if (spans[j].className.indexOf('price-m') != -1) {
						buyItNow = spans[j].getElementsByClassName('value')[0];
						var tc = buyItNow.textContent;
						buyItNowPrice = tc.match(price)[1].replace(',', '');
					}
				}
			}
			if (allElements[i].innerHTML.indexOf('strong class="free-s') == -1) {
				var dl = allElements[i].getElementsByTagName('dl');
				for (var k = 0; k < dl.length; ++k) {
					if (dl[k].className.indexOf("pnl-shipping") != -1) {
						var tc = dl[k].getElementsByClassName('value')[0].textContent;
						shiptext = dl[k].getElementsByTagName('dt')[0];
						shipsep = dl[k].getElementsByClassName('separator')[0];
						shipping = dl[k].getElementsByClassName('value')[0];
						if (price.test(tc)) {
							shippingPrice = tc.match(price)[1].replace(',', '');
							if (unitPrice != 0) {
								shippingPrice = shippingPrice * unitPrice;
							}
						}
					}
				}
			} else {
				shipping = allElements[i].getElementsByTagName('strong')[0];
				shippingPrice = 0;
			}

			var buyItNowTotal;
			if (buyItNowPrice != -1 && shippingPrice != -1) {
				buyItNowTotal = (parseFloat(buyItNowPrice) + parseFloat(shippingPrice));
				if (unitPrice != 0 && buyItNowPriceB != -1) {
					buyItNowTotal = (buyItNowTotal + parseFloat(buyItNowPriceB)) - buyItNowPrice;
				}
				buyItNowTotal = buyItNowTotal.toFixed(2);
				if (buyItNowB) {
					buyItNow.innerHTML = buyItNowB.innerHTML.substring(0, buyItNowB.innerHTML.indexOf('$') + 1) + buyItNowTotal;
					buyItNow.parentNode.getElementsByClassName('unit')[0].innerHTML = buyItNowB.parentNode.getElementsByClassName('unit')[0].innerHTML;
					buyItNowB.parentNode.parentNode.removeChild(buyItNowB.parentNode);
				} else {
					buyItNow.innerHTML = buyItNow.innerHTML.substring(0, buyItNow.innerHTML.indexOf('$') + 1) + buyItNowTotal;
				}
				if (shipsep) {
					shipsep.innerHTML = 'shipping / ';
				}
				var indivTotal;
				if (shippingPrice == 0) {
					if (unitPrice > 1) {
						indivTotal = (parseFloat(parseFloat(buyItNowPriceB) / unitPrice) + parseFloat(shippingPrice)).toFixed(2);
					} else {
						indivTotal = buyItNowTotal;
					}
					shipping.innerHTML = '$' + indivTotal + ' each + FREE SHIPPING';
				} else {
					if (unitPrice > 1) {
						indivTotal = (parseFloat(parseFloat(buyItNowPrice) / unitPrice) + parseFloat(shippingPrice)).toFixed(2);
						var indt2 = parseFloat(parseFloat(buyItNowTotal) / parseFloat(unitPrice));
						if (indivTotal > indt2) {
							indivTotal = indt2.toFixed(2);
						}
					} else {
						indivTotal = buyItNowTotal;
					}
					shipping.innerHTML = '$' + indivTotal + ' each, including ' + shipping.innerHTML.substring(shipping.innerHTML.indexOf('$'));
				}
				if (shiptext) {
					shiptext.parentNode.removeChild(shiptext);
				}
			}
			ListingRanks.push({
				totalprice : buyItNowTotal,
				price : indivTotal,
				units : unitPrice,
				el : RowElement
			});
		}
	}
}

var page_request = new XMLHttpRequest();
page_request.onreadystatechange = function () {
	if (page_request.readyState == 4 && page_request.status == 200) {
		var div = window.content.document.createElement('div');
		try {
			var prt = page_request.responseText;
			var rt = prt;
			rt = rt.substring(rt.indexOf('<tbody id="wishlist-tbody">') - 1);
			rt = rt.substring(0, rt.indexOf('</tbody>') + 9);
			div.innerHTML = '<html><head></head><body><table><thead><tr><th></th><th></th><th></th></tr></thead>' + rt + '</table></body></html>';
			var pnumel = prt;
			pnumel = pnumel.substring(pnumel.indexOf('<div class="page-number">') + 25);
			pnumel = pnumel.substring(0, pnumel.indexOf('</div>'));
			var cnum = pnumel.substring(pnumel.indexOf('Page') + 5);
			cnum = cnum.substring(0, cnum.indexOf(' '));
			var nnum = pnumel.substring(pnumel.indexOf('of ') + 3);
			if (cnum == nnum) {
				doneLoading = 1;
				finalProcessing();
				return;
			}
			grabOrders(div);
			div = null;
			currentPage++;
			loadAPage();
		} catch (e) {}
	}
};

if (location.href.indexOf('/item') != -1 || location.href.indexOf('/store/product') != -1 || location.href.indexOf('SearchText=') != -1) {
	if (location.href.indexOf('/category/') == -1) {
		var titledata = GM_getValue('titledata');
		if (titledata) {
			var wishb = document.createElement('div');
			var q = document.createElement('input');
			var qh = document.createElement('input');
			var qh2 = document.createElement('input');
			var qf = document.createElement('form');
			var title = document.createElement('h2');
			title.class = 'ui-box-title';
			title.innerHTML = 'Similar Wishlist Items';
			wishb.id = 'wishlist-tbody';
			wishb.setAttribute('style', 'align:top;position:absolute;width:18%');
			q.id = 'q';
			qh.id = 'qh';
			qh2.id = 'qh2';
			q.type = 'hidden';
			qh.type = 'hidden';
			qh2.type = 'hidden';
			qh.value = GM_getValue('wishdata');
			qh2.value = titledata;
			document.getElementById('header').appendChild(title);
			document.getElementById('header').appendChild(wishb);
			qf.appendChild(q);
			qf.appendChild(qh);
			qf.appendChild(qh2);
			document.getElementById('header').appendChild(qf);
			if (location.href.indexOf('SearchText=') != -1) {
				q.value = document.getElementById('search-key').value;
				search('Contains Text');
			} else {
				q.value = document.getElementsByClassName('product-name')[0].innerHTML;
				search('Relative', 0.4);
			}
			if (location.href.indexOf('/item') != -1){
				add_jQuery(GM_main, jqver);
			}
		}
		try {
			var wishbtn = document.getElementsByClassName('add-to-wishlist');
			if (wishbtn.length > 0) {
				//var wishdiv = document.createElement('div');
				//wishdiv.innerHTML = '<html><head></head><body><table><thead><tr><th></th><th></th><th></th></tr></thead>' + this + '</table></body></html>';
				wishbtn[0].firstChild.addEventListener("click", function () {
					GM_setValue('wishdata', JSON.parse(GM_getValue('wishdata')) + this.parentNode.parentNode.parentNode);
					console.info(GM_getValue('wishdata'));
					GM_setValue('titledata', JSON.parse(GM_getValue('titledata')) + this.title);
					console.info(GM_getValue('titledata'));
				}, false);
			}
		} catch (e) {}
	}
} else if (location.href.indexOf('/wishlist') != -1) {
	var cp = document.getElementsByClassName('page-number')[0].innerHTML;
	cp = cp.substring(cp.indexOf('Page') + 5);
	cp = cp.substring(0, cp.indexOf(' '));
	if (cp == 1) {
		currentPage = 2;
		grabOrders(document);
		//}
		var srchel = document.createElement('li');
		var qt = document.createElement('label');
		var qf = document.createElement('form');
		var qh = document.createElement('input');
		var qh2 = document.createElement('input');
		var q = document.createElement('input');
		var qb = document.createElement('input');
		qb.id = 'qb';
		qb.type = 'button';
		qb.value = 'Search';
		qb.disabled = true;
		qt.id = 'qt';
		qt.innerHTML = 'Loading search.. please wait.';
		q.disabled = true;
		qh.type = 'hidden';
		qh.id = 'qh';
		qh2.type = 'hidden';
		qh2.id = 'qh2';
		q.id = 'q';
		q.size = 20;
		qf.appendChild(qt);
		qf.appendChild(document.createElement('br'));
		qf.appendChild(qh);
		qf.appendChild(qh2);
		qf.appendChild(q);
		qf.appendChild(qb);
		srchel.appendChild(qf);
		document.getElementsByClassName('tabs')[0].appendChild(srchel);
		var titledata = GM_getValue('titledata');
		if (titledata) {
			var firsttitle = document.getElementsByTagName('tbody')[0].getElementsByTagName('tr')[0].getElementsByClassName('main-info-hd')[0].getElementsByTagName('a')[0].innerHTML;
			if (firsttitle && titledata.indexOf(firsttitle) != -1) {
				loadsearch();
			} else {
				loadAPage();
			}
		} else {
			loadAPage();
		}
	}
}
