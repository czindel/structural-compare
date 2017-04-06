(function () {

    var checkerList = [];
    checkerList.push(checkExactMatch);
    checkerList.push(checkSiblings);
    // checkerList.push(checkByTagNameAndClassList);
    // checker.push(checkImageAttributes);

    var logList;
    var logCount;
    var ignoreSelector;

    function startCompare(expected, actual, ignore) {
        console.log('startCompare', expected, actual);
        logList = [];
        logCount = 0;
        ignoreSelector = ignore;

        //TODO compare expected & actual, not only children
        compareChildren(expected, actual);

        // console.log(_.map(_.groupBy(logList, 'expectedCssPath'), function (entry, key) {
        //     return {key: entry[0].expectedString, value:entry }
        // }));
    }

    function compareChildren(expected, actual) {

        var $expectedChildren = $(expected).children();
        var $actualChildren = $(actual).children();
        var foundNodes = [];

        $expectedChildren.each(function (i, expectedChild) {

            var $expectedChild = $(expectedChild);
            var $actualChild = $actualChildren.eq(i);
            var actualChild = $actualChild[0];
            var matchingNode = null;

            for (var j = 0, l = checkerList.length; j < l; j++) {

                var result = checkerList[j](expectedChild, actualChild, matchingNode);
                if (result && result.match) {
                    matchingNode = result.match;

                    foundNodes.push(matchingNode);
                }
            }

            if (!matchingNode) {

                if (!ignoreSelector || !$(expectedChild).is(ignoreSelector)) {
                    log('missing tag', null, expectedChild, null);
                }
            }

            // recursive check children
            if (matchingNode && $expectedChild.children().length) {
                compareChildren(expectedChild, matchingNode)
            }
        });

        var diff = _.difference($actualChildren, foundNodes);
        if (diff.length) {
            diff.forEach(function (entry) {
                if (!ignoreSelector || !$(entry).is(ignoreSelector)) {
                    log('unexpected tag', null, null, entry);
                }
            })
        }
    }

    function checkExactMatch(expectedChild, actualChild, matchingNode) {

        if (matchingNode) {
            return null;
        }

        var expectedClasses = Array.prototype.slice.call(expectedChild.classList);

        var selector = expectedChild.tagName.toLowerCase();
        if (expectedClasses.length) {
            selector += '.' + expectedClasses.join('.');
        }

        if ($(actualChild).is(selector)) {
            return {match: actualChild};
        }
        else {
            return null
        }
    }

    function checkByTagNameAndClassList(expectedChild, actualChild, matchingNode) {

        if (matchingNode) {
            return null;
        }

        if (!expectedChild || !actualChild) {
            return null;
        }

        var expectedClasses = Array.prototype.slice.call(expectedChild.classList);
        var actualClasses = Array.prototype.slice.call(actualChild.classList);

        var intersection = _.intersection(expectedClasses, actualClasses);
        if (!intersection.length) {
            return null;
        }

        var expectedActualDiff = _.difference(expectedClasses, actualClasses);
        if (expectedActualDiff.length) {
            log('missing classes', expectedActualDiff, expectedChild, actualChild);
        }

        var actualExpectedDiff = _.difference(actualClasses, expectedClasses);
        if (actualExpectedDiff.length) {
            log('unexpected classes', actualExpectedDiff, expectedChild, actualChild);
        }

        if (actualChild.tagName != expectedChild.tagName) {
            log('wrong tag-name', actualChild.tagName, expectedChild, actualChild);
        }

        return {match: actualChild};
    }

    function checkSiblings(expectedChild, actualChild, matchingNode) {

        if (matchingNode) {
            return null;
        }

        var match = null;

        $(actualChild).siblings().each(function (j, sibling) {

            if (checkExactMatch(expectedChild, sibling)) {
                log('wrong position', null, expectedChild, sibling);
                match = sibling;
                return;
            }

            // if (checkByTagNameAndClassList(expectedChild, sibling)) {
            //     log('wrong position', null, expectedChild, sibling);
            //     match = sibling;
            //     return;
            // }
        });

        if (match) {
            return {match: match}
        }

        return null;
    }

    function checkImageAttributes(expectedChild, actualChild, matchingNode) {

        var $expectedChild = $(expectedChild);

        if (!$expectedChild.is('img') || !matchingNode) {
            return null;
        }

        var $matchingNode = $(matchingNode);

        if ($expectedChild.attr('sizes') !== $matchingNode.attr('sizes')) {
            console.log('sizes attribute does not match', expectedChild, matchingNode);
        }

        var expectedDescriptors = $expectedChild.attr('srcset').split(',').map(function (src) {
            return src.split(' ')[1];
        });

        var compareDescriptors = $matchingNode.attr('srcset').split(',').map(function (src) {
            return src.split(' ')[1];
        });

        if (_.difference(expectedDescriptors, compareDescriptors).length || _.difference(compareDescriptors, expectedDescriptors).length) {
            console.log('srcset descriptors do not match', expectedChild, matchingNode);
        }

        return null;
    }

    function checkDataAttributes() {

    }

    function log(msg, detail, expected, actual) {

        logCount++;

        var expectedString = '';
        var actualString = '';

        if (expected) {
            expectedString = expected.outerHTML.match(/(<.*?>)/)[1];
        }
        if (actual) {
            actualString = actual.outerHTML.match(/(<.*?>)/)[1];
        }

        logList.push({
            msg: msg,
            expected: expected,
            expectedString: expectedString,
            expectedCssPath: cssPath(expected),
            actual: actual,
            actualString: actualString,
            actualCssPath: cssPath(actual)
        });

        var $row = $('<div></div>');

        var $headline = $('<h4>' + logCount + '. ' + msg + '</h4>').appendTo($row);
        if (detail) {
            $headline.append('<small> (' + detail + ')</small>');
        }

        var diff = difflib.unifiedDiff([expectedString],
            [actualString], {
                fromfile: 'expectedUrl',
                tofile: 'actualUrl',
                lineterm: ''
            });
        var diff2htmlUi = new Diff2HtmlUI({diff: diff.join('\n')});
        var $diff = $('<div></div>').appendTo($row);
        diff2htmlUi.draw($diff, {inputFormat: 'diff', showFiles: false, matching: 'lines'});

        // if (expected) {
        //     $('<p style="font-size: 9px; margin:0;">Expected: <small><code></code></small></p>')
        //         .appendTo($row).find('code').text(cssPath(expected))
        // }
        // if (actual) {
        //     $('<p style="font-size: 9px; margin: 0;">Actual: <small><code></code></small></p>')
        //         .appendTo($row).find('code').text(cssPath(actual))
        // }

        $row.append('<br>').appendTo($('#log'));
    }

    function cssPath(el) {

        if (!(el instanceof Element)) return;

        var path = [];

        while (el && el.nodeType === Node.ELEMENT_NODE) {

            var selector = el.nodeName.toLowerCase();

            if (el.id) {
                selector += '#' + el.id;
            }
            else {
                var sib = el, nth = 1;

                // if (el.classList.length) {
                //     var classesArray = Array.prototype.slice.call(el.classList);
                //     selector += "." + classesArray.join('.');
                // }

                while (sib.nodeType === Node.ELEMENT_NODE && (sib = sib.previousSibling) && nth++);
                selector += ":nth-child(" + nth + ")";
            }
            path.unshift(selector);
            el = el.parentNode;
        }

        return path.join(" > ");

        // if(!el)
        //     return "";
        // if(el.id)
        //     return "#" + el.id;
        // if(el.tagName == "BODY")
        //     return '';
        // var path = cssPath(el.parentNode);
        // if(el.className)
        //     return path + " " + el.tagName + "." + el.className;
        // return path + " " + el.tagName;
    }

    var expectedUrl;
    var actualUrl;


    $('#btn-compare_v1').on('click', function () {

        $('#log').empty();

        var expectedSelector = $('#expected_selector').val();
        var actualSelector = $('#actual_selector').val();
        var ignoreSelector = $('#expected_selector_ignore').val();

        expectedUrl = '/api/proxy?url=' + encodeURIComponent($('#expected_url').val());
        actualUrl = '/api/proxy?url=' + encodeURIComponent($('#actual_url').val());

        $.when($.get(expectedUrl), $.get(actualUrl)).then(function (responseExpected, responseActual) {

            var $expected = $(responseExpected[0]);
            var $expectedTarget = $expected.filter(expectedSelector).add($expected.find(expectedSelector));
            $expected = null;

            var $actual = $(responseActual[0]);
            var $actualTarget = $actual.filter(actualSelector).add($actual.find(actualSelector));
            $actual = null;

            startCompare($expectedTarget[0], $actualTarget[0], $('#expected_selector_ignore').val());
        });

    });

})();