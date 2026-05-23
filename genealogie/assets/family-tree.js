
/* global fileOptions */
//var fileOptions;  // defined in HTML-File (caption, notes and generation)

var treedata = [];  // tree in JSON-format
var parents = [];

// disable logging, uncomment this:
console.log = function () { };

$(function () {

    if (treedata.length > 0) {
        // called second time !?
        alert("Repeated function call (family-tree.js)!");
        return;
    }

    getParams();

    createTreeObject(); // JSON

    createTree();

    createContextMenu();
    finalWork();

    setupNotes();

    // Scroll to center of root node
    let rootNode = $('.org-node:first > div')[0];
    let rootCenter = rootNode.offsetLeft + (rootNode.offsetWidth / 2);
    document.documentElement.scrollLeft = rootCenter - (document.body.clientWidth / 2);

    // Scrool to center of scrollWidth
    //document.documentElement.scrollLeft = (document.body.scrollWidth - document.body.clientWidth) / 2;

    return false;
});

function getParams() {
    const urlParams = new URLSearchParams(location.search);

    if (urlParams.has('title')) {
        $('#caption').prepend('Stammbaum ' + urlParams.get('title') + ' | ');
    }
    if (urlParams.has('sub')) {
        fileOptions.subtreeID = urlParams.get('sub');
    }
    if (urlParams.has('hidden')) {
        const hidden = urlParams.get('hidden').split(',');
        fileOptions.hiddenSubIDs = hidden;
    }
    if (urlParams.has('maxGen')) {
        optMaxGen = urlParams.get('maxGen');
        if (optMaxGen !== undefined)
            fileOptions.maxGen = parseInt(optMaxGen);
    }
}

/* *** Extract nested List (UL/LI) *** */
function createTreeObject() {
    var subtreeID = fileOptions.subtreeID;
    if (subtreeID === undefined || subtreeID === '0')
        subtreeID = '1';
    var hiddenSubIDs = fileOptions.hiddenSubIDs;
    if (hiddenSubIDs === undefined)
        hiddenSubIDs = [];
    var maxGen = fileOptions.maxGen;
    if (maxGen === undefined)
        maxGen = 0;

    if (maxGen > 0) {
        var subGen = subtreeID.length;
        maxGen = Math.pow(10, (subGen + maxGen - 1));
    }

    function children(id, items) {
        for (var i = 0; i < items.length; i++) {
            if (items[i].tagName === 'UL') {
                if (treedata.length > 0) {
                    if (maxGen > 1 && id >= maxGen)
                        return;
                    var subID = '' + (id / 10); // parent
                    if (hiddenSubIDs.includes(subID)) {
                        return;
                    }
                }
                // examine children (LI-entries)
                children(id, $(items[i]).children('LI'));

            } else if (items[i].tagName === 'LI') {
                // generate child-object, examine its children
                var child = {};
                child.id = '' + (id + i + 1);
                if (i >= 9) {
                    alert('Too many siblings: ' + id / 10);
                    break;
                }
                //                if (i < 9) {
                //                    child.id = '' + (id + i + 1);
                //                } else {
                //                    var x = 'ABCDEFGHIJ';
                //                    child.id = '' + (id/10) + x.substr(i-9,1);
                //                }
                child.parent = (id === 0) ? '' : '' + (id / 10);
                child.body = extractNode($(items[i]), false);
                if (items[i].className !== '')
                    child.styleClass = items[i].className;
                // optional restrict to a subtree
                if (child.id.startsWith(subtreeID)) {
                    if (child.id === subtreeID)
                        child.parent = '';
                    treedata.push(child);
                }
                // if node has children
                if ($(items[i]).children('UL').length > 0) {
                    if (child.styleClass === undefined)
                        child.styleClass = 'children';
                    else
                        child.styleClass += ' children';
                    if (hiddenSubIDs.includes(child.id))
                        child.styleClass += ' closed';
                }
                // examine children (UL - list-entries)
                children(child.id * 10, $(items[i]).children('UL'));
            }
        }
    }

    // get filename as document title
    var url = window.location.pathname;
    var fname = url.replace(/^.*[\\\/]/, '');
    fname = fname.split('.')[0];
    document.title = fname;

    // content: UL/LI
    var htmlData = $("#content")[0].innerHTML;
    children(0, $(htmlData).filter('UL'));

    // insert orgchart, move footnotes beyond 
    $("body").append("<div id='orgchart'></div>");
    if ($("#footnotes").length) {
        $("body").append($("#footnotes"));
    }
}

// sub-function for createTreeObject();
// extract/trim html-string from LI node without UL-children
function extractNode($obj, linefeed) {
    var text = $("<div/>").append(
        $('UL', $obj.clone()).remove().end().html()
    ).html();
    //text = text.replace(/^ +/gm, '');  // with first/last linefeed
    text = text.replace(/^\s*/gm, '');
    if (!linefeed)
        text = text.replace(/[\n\r]+/g, "");
    return text;
}

// ========================================================================

function createTree() {

    //    var caption = document.getElementById("caption");
    //    caption.innerHTML = fileOptions.caption;
    //    if (typeof fileOptions.notes !== "undefined") {
    //        var notes = document.getElementById("notes");
    //        notes.innerHTML = fileOptions.notes;
    //    }

    var pOrgChildNode = {};
    var pOrgNodes = null;

    var missingParents = [];

    for (var key in treedata) {
        var node = treedata[key];

        var child = new nodeParams(node.id, node.body, node.styleClass, node.id);
        pOrgChildNode[node.id] = new OrgNodeV2(child);

        if (node.parent === "") {
            pOrgNodes = pOrgChildNode[node.id];
        } else {
            if (pOrgChildNode[node.parent] === undefined) {
                missingParents.push(node.parent);
                continue;
            }
            pOrgChildNode[node.parent].addNodes(pOrgChildNode[node.id]);
            if ($.inArray(treedata[key].parent, parents) === -1)
                parents.push(treedata[key].parent);
        }
    }
    if (missingParents.length > 0)
        alert("Missing parents (ID's): " + missingParents);

    // Create params for chart.
    var chartParams = {
        options: {
            top: 12,
            left: 12,
            line: {
                size: 2,
                color: "#3388dd"
            },
            node: {
                width: 64,
                heigth: 64,
                maxWidth: 128,
                maxHeight: 128,
                template: "<div id=\"{id}\" class=\"{styleClass}\" title=\"{tooltip}\">{description}</div>"
            }
        },
        event: {
            node: {
                onProcess: null,
                onClick: null,
                onMouseMove: null,
                onMouseOver: null,
                onMouseOut: null
            },
            onCreate: null,
            onError: null,
            onFinish: null
        },
        nodes: pOrgNodes
    };

    // Create OrgChartV2 (js-orgchart-2.js)
    var pChart = new OrgChartV2(chartParams);
    pChart.render();

    // Adjust space for orgchart div
    var orgchart = document.getElementById("orgchart");
    var maxWidth = 0, maxHeight = 0;
    for (var i = 0; i < orgchart.childNodes.length; i++) {
        var child = orgchart.childNodes[i];
        if (child.id.substr(0, 7) !== 'orgnode')
            break;
        var orgnode = child.firstChild.firstChild;
        var width = orgnode.offsetLeft + orgnode.offsetWidth;
        var height = orgnode.offsetTop + orgnode.offsetHeight;
        if (width > maxWidth)
            maxWidth = width;
        if (height > maxHeight)
            maxHeight = height;
    }
    maxWidth += 20;
    maxHeight += 20;
    orgchart.style.width = "" + maxWidth + "px";
    orgchart.style.height = "" + maxHeight + "px";
}

// sub-function for createTree();
function nodeParams(_caption, _description, _styleClass, _tooltip) {
    this.options = {
        targetName: "orgchart",
        subTargetName: "orgnode",
        clsName: "org-node"
    };
    let tt_f = numberWithDots(_tooltip)
    this.customParams = {
        caption: _caption,
        description: _description,
        styleClass: _styleClass,
        tooltip: tt_f
    };
}
function numberWithDots(tt) {
    let tt_f = '';
    for (var i = 0, charsLength = tt.length; i < charsLength; i += 3) {
        tt_f += tt.substring(i, i + 3) + '.';
    }
    return tt_f.slice(0, -1);
}

// ========================================================================
var $cmenu;

function createContextMenu() {
    // Create node context menu
    $cmenu = $("<div>", { class: "cmenu" });
    $cmenu.append($("<a>", {
        href: "#", onclick: "$cmenu.hide();isolateSubtree();"
    }).text("Isolate subtree"));
    $cmenu.append($("<a>", {
        href: "#", onclick: "$cmenu.hide();hideSubtree();"
    }).text("Toggle subtree"));
    // $cmenu.append($("<a>", {
    //     href: "#", onclick: "$cmenu.hide();createChild();"
    // }).text("Create child"));
    $cmenu.appendTo($('body'));

    // hide cmenu on click anywhere outside of it
    $(document).mousedown(function (e) {
        if (!$cmenu.is(e.target) && $cmenu.has(e.target).length === 0) {
            $cmenu.hide();
        }
    });
}

function finalWork() {
    // add event handler to nodes for folding
    $('.children:not(:first)').on('contextmenu', function (e) {
        $cmenu.css({ top: e.pageY + 5, left: e.pageX + 5 });
        $cmenu.data("node", this);
        $cmenu.show();
        return false;
    });

    // separate inline children
    $('div.org-node .inline-child').each(function () {
        pHeight = $(this).parent().height() - $(this).height() - 20;
        $(this).parent().height(pHeight);
    });
}

function hideSubtree() {
    // save node ID:
    var pNodeID = $('.cmenu').data("node").title;
    //    $('.cmenu').remove();
    // Baum löschen
    treedata = [];
    parents = [];
    $("#orgchart")[0].remove();
    $('.genNumber').remove();
    // node ID: {add to/remove from} array of hidden sub ID's:
    if (fileOptions.hiddenSubIDs === undefined)
        fileOptions.hiddenSubIDs = [];
    pNodeNo = pNodeID.replaceAll(".", "");
    let i = $.inArray(pNodeNo, fileOptions.hiddenSubIDs);
    if (i === -1) {
        fileOptions.hiddenSubIDs.push(pNodeNo);
    } else {
        fileOptions.hiddenSubIDs.splice(i, 1);
    }
    // Baum neu zeichnen
    createTreeObject();
    createTree();
    finalWork();
    setupNotes();
}

function isolateSubtree() {
    // save node ID:
    var pNodeID = $('.cmenu').data("node").title;
    pNodeID = pNodeID.replace(/[.]/g, '');
    //    $('.cmenu').remove();
    // Baum löschen
    treedata = [];
    parents = [];
    $("#orgchart")[0].remove();
    $('.genNumber').remove();
    // node ID: set to subtree ID:
    fileOptions.subtreeID = pNodeID;
    // Baum neu zeichnen
    createTreeObject();
    createTree();
    finalWork();
    setupNotes();
}

function createChild() {
    var pNodeID = $('.cmenu').data("node").title;
    alert(pNodeID);
}

// ========================================================================

function setupNotes() {

    var $actVisibleNote;

    // create button for general note
    $pagenotes = $('#pagenotes');
    if ($pagenotes.length > 0) {
        $('<div id="bt-pagenotes">&#9432;</div>').prependTo('#orgchart').on('click', function (e) {
            $pagenotes.css({ top: e.pageY + 4, left: e.pageX + 4 });
            showNote($pagenotes);
        });
    }

    // initiate notes
    $notes = $(".notes");
    if ($notes.length > 0) {
        $notes.draggable({ cancel: 'div.content' });
        //        $notes.resizable({
        //            handles: "s",
        //            resize: function (e, ui) {
        //                $title = ui.element.find('.title');
        //                $content = ui.element.find('.content');
        //                var newHeight = ui.element.height() - $title.height() - 9;
        //                $content.height(newHeight);
        //            }
        //        });

        // hide note when button close is cklicked
        $notes.find($('.title')).on('click', function () {
            $(this).parent().hide();
            $actVisibleNote = '';
        });
    }

    // show note cenetered
    $('[data-note]').on('click', function (e) {
        e.stopPropagation();
        let noteName = $(this).data('note');
        let $note = $(noteName);
        let w = $note.outerWidth();  // save the width; it will be changed in some cases !?!
        var $win = $(window);
        let left = Math.abs((($win.width() - $note.outerWidth()) / 2) + $win.scrollLeft());
        let top = Math.abs((($win.height() - $note.outerHeight()) / 2) + $win.scrollTop());
        if (top < $win.scrollTop())
            top = $win.scrollTop();
        $note.css({'top': top, 'left': left});
        $note.outerWidth(w);  // reset width !?!
        showNote($note);
    });


    // hide note when clicked outside
    $(document).click(function (event) {
        var $target = $(event.target);
        if ($target[0] === $("#bt-pagenotes")[0]) return;
        if (!$target.closest($actVisibleNote).length &&
            $actVisibleNote.is(':visible')) {
            $actVisibleNote.hide();
            $actVisibleNote = '';
        }
    });

    // show note; hide other note
    function showNote($note) {
        if (typeof $actVisibleNote !== 'undefined' && $actVisibleNote !== '') 
            $actVisibleNote.hide();
        $note.show();
        $actVisibleNote = $note;
    }

}

// ========================================================================

