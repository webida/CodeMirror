define(['lib/codemirror/lib/codemirror', 'underscore'], function(CodeMirror, _) {
(function () {
  "use strict";

  var spec = CodeMirror.resolveMode("text/css");
  var propertyKeywords =_.keys(spec.propertyKeywords);
  var valueKeywords = _.keys(spec.valueKeywords).concat(_.keys(spec.colorKeywords));

  function getHints(cm) {
    var cur = cm.getCursor(), token = cm.getTokenAt(cur);
    var inner = CodeMirror.innerMode(cm.getMode(), token.state);
    if (inner.mode.name != "css") return;

    // If it's not a 'word-style' token, ignore the token.
    if (!/^[\w$_-]*$/.test(token.string)) {
      token = {
        start: cur.ch, end: cur.ch, string: "", state: token.state,
        type: null
      };
      var stack = token.state.stack;
      var lastToken = stack && stack.length > 0 ? stack[stack.length - 1] : "";
      if (token.string == ":" || lastToken.indexOf("property") == 0)
        token.type = "variable";
      else if (token.string == "{" || lastToken.indexOf("rule") == 0)
        token.type = "property";
    }

    if (!token.type)
      return;

    var keywords = null;
    if (token.type.indexOf("property") == 0)
      keywords = propertyKeywords;
    else if (token.type.indexOf("variable") == 0)
      keywords = valueKeywords;

    if (!keywords)
      return;

    function commonstring(str, sub) {
      function calculateCommon(strP, subP) {
        if (subP < sub.length) {
          var n = str.substring(strP).indexOf(sub.charAt(subP));
          if (n < 0) { return; }
          var p = 1;
          while (subP + p < sub.length && str.charAt(strP + n + p) === (sub.charAt(subP + p))) {
            p++;
          }
          if (subP + p >= sub.length) {
            return [{start: strP + n, len: p}];
          } else {
            var rest = calculateCommon(strP + n + p, subP + p);
            if (rest) {
              rest.push({start: strP + n, len: p});
              return rest;
            }
          }
        }
      }
      function calculateRelevance(common) {
        var mcp = _.max(common, function (c) { return c.len; });
        var rel = mcp.len - str.length - mcp.len;
        return rel;
      }
      var common = calculateCommon(0, 0);
      if (common) {
        return (function (str, sub, common) {
          var render = function (elem /*, self, data*/) {
            var e = $(elem).html('');
            function appendNormal(e, str) {
              e.append($('<span>').text(str));
            }
            function appendBold(e, str) {
              e.append($('<span class="CodeMirror-hint-common-string">').text(str));
            }
            var first = _.first(common);
            if (first.start > 0) {
              appendNormal(e, str.substring(0, first.start));
            }
            for (var i = 0; i < common.length; i++) {
              var self = common[i];
              if (i > 0) {
                var prev = common[i - 1];
                appendNormal(e, str.substring(prev.start + prev.len, self.start));
              }
              appendBold(e, str.substr(self.start, self.len));
            }
            var last = _.last(common);
            if (last.start + last.len < str.length) {
              appendNormal(e, str.substring(last.start + last.len));
            }
          };
          return {
            render: render,
            relevance: calculateRelevance(common)
          };
        })(str, sub, common.reverse());
      }
    }
    var tstr = token.string.toLowerCase();
    var result = _.sortBy(_.compact(_.map(keywords, function (w) {
      var renderer = commonstring(w, tstr);
      if (renderer) {
        return {
          text: w,
          render: renderer.render,
          relevance: renderer.relevance
        };
      }
    })), function (item) { return -item.relevance; });
    if (! _.isEmpty(result)) {
      return {
        list: result,
        from: CodeMirror.Pos(cur.line, token.start),
        to: CodeMirror.Pos(cur.line, token.end)
      };
    } else {
      return {
        list: keywords,
        from: cur,
        to: cur
      };
    }
  }

  CodeMirror.registerHelper("hint", "css", getHints);
})();
});
