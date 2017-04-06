(function () {

    function ExpectedToActualMap() {
        this._list = [];
    }

    Object.assign(ExpectedToActualMap.prototype, {

        add: function (item) {
            this._list.push({
                type: item.type,
                expected: item.expected || null,
                actual: item.actual || null,
                expectedIndex: item.expectedIndex || null,
                actualIndex: item.actualIndex || null,
                childMapping: item.childMapping || null,
                ignored: item.ignored || false
            });
        },

        list: function () {
            return this._list;
        },

        containsActual: function (actual) {
            return this._list.find(function (entry) {
                return entry.actual === actual;
            })
        },

        containsExpected: function (expected) {
            return this._list.find(function (entry) {
                return entry.expected === expected;
            })
        }
    });


    // -----------------


    let exactMatcher = {
        name: 'exact match',
        check: function (expectedChild, actualChildren, mapping) {

            let match = null;

            let expectedClasses = Array.prototype.slice.call(expectedChild.classList);
            let selector = expectedChild.tagName.toLowerCase();
            if (expectedClasses.length) {
                selector += '.' + expectedClasses.join('.');
            }

            if (!actualChildren) {
                return null;
            }

            for (let i = 0, l = actualChildren.length; i < l; i++) {
                let actualChild = actualChildren[i];
                if (!match && !mapping.containsActual(actualChild)) {
                    if (actualChild.matches(selector)) {
                        match = {node: actualChild, index: i};
                        break;
                    }
                }
            }

            return match;
        }
    };

    let similarMatcher = {
        name: '',
        check: function (expectedChild, actualChildren, mapping) {

            let expectedClasses = [].slice.call(expectedChild.classList);
            let list = [];

            if (!actualChildren) {
                return null;
            }

            for (let i = 0, l = actualChildren.length; i < l; i++) {
                let actualChild = actualChildren[i];

                if (!mapping.containsActual(actualChild)) {

                    let actualClasses = Array.prototype.slice.call(actualChild.classList);
                    let sharedClasses = expectedClasses.filter(function (entry) {
                        return actualClasses.includes(entry)
                    });

                    if (sharedClasses.length) {

                        list.push({
                            node: actualChild,
                            sharedClasses: sharedClasses,
                            onlyExpected: expectedClasses.filter(function (entry) {
                                return !actualClasses.includes(entry)
                            }),
                            onlyActual: actualClasses.filter(function (entry) {
                                return !expectedClasses.includes(entry)
                            }),
                            tagNameMatch: actualChild.tagName !== expectedChild.tagName
                        });
                    }
                }
            }

            let ratedList = list.map(function (item) {

                let rating = item.sharedClasses.length;
                rating -= item.onlyExpected.length;
                rating -= item.onlyActual.length;
                rating += item.tagNameMatch ? 1 : 0;

                item.rating = rating;

                return item
            });

            ratedList.sort(function (a, b) {
                if (a.rating < b.rating) return -1;
                if (a.rating > b.rating) return 1;
                return 0;
            });

            if (ratedList.length) {
                return {
                    match: ratedList[0].node,
                    info: ratedList[0]
                };
            }
        }
    };


    // -----------------


    let matcherList = [];
    matcherList.push(exactMatcher);
    matcherList.push(similarMatcher);

    let logCount;
    let ignoreSelector;

    function startCompare(expected, actual, ignore) {

        logCount = 0;
        ignoreSelector = ignore;

        //TODO compare expected & actual, not only children
        let mapping = compareChildren(expected, actual);
        console.log('done', mapping);
    }

    function compareChildren(expected, actual) {

        let mapping = new ExpectedToActualMap();

        let expectedChildren = expected.children;
        let actualChildren = actual && actual.children;

        matcherList.forEach(function (matcher) {

            [].forEach.call(expectedChildren, function (expectedChild, i) {

                let ignore = expectedChild.matches(ignoreSelector);

                if (!mapping.containsExpected(expectedChild)) { // skip if already mapped

                    let match = matcher.check(expectedChild, actualChildren, mapping);
                    if (match) {
                        if (!mapping.containsActual(match.node)) {  // already mapped

                            let childMapping;
                            if (!ignore && expectedChild.children.length) {
                                childMapping = compareChildren(expectedChild, match.node);

                                if (!childMapping.length) {
                                    console.log('no matching children');
                                }
                            }

                            mapping.add({
                                type: matcher.name,
                                expected: expectedChild,
                                actual: match.node,
                                expectedIndex: i,
                                actualIndex: match.index,
                                childMapping: childMapping,
                                ignored: ignore
                            });
                        }
                        else {

                            console.log('duplicate actual');

                            if (ignore) {
                                mapping.add({
                                    expected: expectedChild,
                                    expectedIndex: i,
                                    ignored: true
                                });
                            }
                        }
                    }
                    else {
                        if (ignore) {
                            mapping.add({
                                expected: expectedChild,
                                expectedIndex: i,
                                ignored: true
                            });
                        }
                    }
                }
            })
        });

        // TODO check order

        [].forEach.call(expectedChildren, function (expectedChild) {
            if (!mapping.containsExpected(expectedChild)) {
                console.log('no match in actual found for', expectedChild);
            }
        });

        return mapping.list();
    }

    function log(msg, detail, expected, actual) {

        logCount++;

        let expectedString = '';
        let actualString = '';

        if (expected) {
            expectedString = expected.outerHTML.match(/(<.*?>)/)[1];
        }
        if (actual) {
            actualString = actual.outerHTML.match(/(<.*?>)/)[1];
        }

        // logList.push({
        //     msg: msg,
        //     expected: expected,
        //     expectedString: expectedString,
        //     expectedCssPath: cssPath(expected),
        //     actual: actual,
        //     actualString: actualString,
        //     actualCssPath: cssPath(actual)
        // });

        let $row = $('<div></div>');

        let $headline = $('<h4>' + logCount + '. ' + msg + '</h4>').appendTo($row);
        if (detail) {
            $headline.append('<small> (' + detail + ')</small>');
        }

        let diff = difflib.unifiedDiff([expectedString],
            [actualString], {
                fromfile: 'expectedUrl',
                tofile: 'actualUrl',
                lineterm: ''
            });
        let diff2htmlUi = new Diff2HtmlUI({diff: diff.join('\n')});
        let $diff = $('<div></div>').appendTo($row);
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

        let path = [];

        while (el && el.nodeType === Node.ELEMENT_NODE) {

            let selector = el.nodeName.toLowerCase();

            if (el.id) {
                selector += '#' + el.id;
            }
            else {
                let sib = el, nth = 1;

                // if (el.classList.length) {
                //     let classesArray = Array.prototype.slice.call(el.classList);
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
        // let path = cssPath(el.parentNode);
        // if(el.className)
        //     return path + " " + el.tagName + "." + el.className;
        // return path + " " + el.tagName;
    }


    document.querySelector('#btn-compare_v2').addEventListener('click', function () {

        let logNode = document.querySelector('#log');
        while (logNode.firstChild) {
            logNode.removeChild(logNode.firstChild);
        }

        let expectedSelector = document.querySelector('#expected_selector').value;
        let actualSelector = document.querySelector('#actual_selector').value;
        let ignoreSelector = document.querySelector('#expected_selector_ignore').value;

        //let expectedUrl = '/api/proxy?url=' + encodeURIComponent(document.querySelector('#expected_url').value);
        //let actualUrl = '/api/proxy?url=' + encodeURIComponent(document.querySelector('#actual_url').value);
        let expectedUrl = document.querySelector('#expected_url').value;
        let actualUrl = document.querySelector('#actual_url').value;

        let p1 = fetch(expectedUrl).then(function (response) {
            return response.text();
        });
        let p2 = fetch(actualUrl).then(function (response) {
            return response.text();
        });

        Promise.all([p1, p2])
            .then(function (contents) {

                let responseExpected = contents[0];
                let responseActual = contents[1];

                // let $expected = $(responseExpected[0]);
                let expectedElement = document.createElement('html');
                expectedElement.innerHTML = responseExpected;
                // let $expectedTarget = $expected.filter(expectedSelector).add($expected.find(expectedSelector));
                let expectedTarget = expectedElement.querySelector(expectedSelector);

                // let $actual = $(responseActual[0]);
                let actualElement = document.createElement('html');
                actualElement.innerHTML = responseActual;
                // let $actualTarget = $actual.filter(actualSelector).add($actual.find(actualSelector));
                let actualTarget = actualElement.querySelector(actualSelector);

                // startCompare($expectedTarget[0], $actualTarget[0], $('#expected_selector_ignore').val());
                startCompare(expectedTarget, actualTarget, ignoreSelector);
            });
    });
})();