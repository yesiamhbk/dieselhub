// UTM & gclid capture + attach to /api/order
(function () {
  try {
    var KEY = "utm_data";
    var stored = {};
    try { stored = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) {}

    var params = new URLSearchParams(window.location.search || "");
    var fields = ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","gclid"];
    var hasAny = fields.some(function (f) { return params.get(f); });

    if (hasAny || !stored.ts) {
      var updated = Object.assign({}, stored);
      fields.forEach(function (f) {
        var v = params.get(f);
        if (v) updated[f] = v;
      });
      if (!updated.landing_url) updated.landing_url = window.location.href;
      if (!updated.referrer && document.referrer) updated.referrer = document.referrer;
      if (!updated.ts) updated.ts = Date.now();
      localStorage.setItem(KEY, JSON.stringify(updated));
    }

    var _fetch = window.fetch;
    window.fetch = function (input, init) {
      try {
        var isOrderEndpoint = false;
        if (typeof input === "string") {
          isOrderEndpoint = input.includes("/api/order");
        } else if (input && input.url) {
          isOrderEndpoint = String(input.url).includes("/api/order");
        }

        if (isOrderEndpoint) {
          init = init || {};
          var headers = init.headers || {};
          var contentType = "";
          if (typeof headers.get === "function") {
            contentType = headers.get("content-type") || headers.get("Content-Type") || "";
          } else {
            contentType = headers["content-type"] || headers["Content-Type"] || "";
          }

          if (String(init.method || "POST").toUpperCase() === "POST" && contentType.includes("application/json")) {
            var bodyObj = {};
            try { bodyObj = JSON.parse(init.body || "{}"); } catch (e) {}
            var utm = {};
            try { utm = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) {}

            bodyObj.utm = Object.assign({}, utm, bodyObj.utm || {});
            init.body = JSON.stringify(bodyObj);
          }
          init.headers = headers;
        }
      } catch (e) {}
      return _fetch(input, init);
    };
  } catch (e) {}
})();
