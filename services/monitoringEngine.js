import dns from "dns/promises";

// SSRF Protection Helper
export async function validateUrl(urlStr, allowLocalhost = false) {
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error("Invalid URL format");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS protocols are allowed");
  }

  if (!allowLocalhost) {
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname.endsWith(".local") ||
      hostname === "169.254.169.254" // Cloud metadata
    ) {
      throw new Error("SSRF blocked: Requests to localhost or cloud metadata are prohibited");
    }

    // Resolve DNS to verify it doesn't resolve to private IP range
    try {
      const addresses = await dns.lookup(hostname, { all: true });
      for (const addr of addresses) {
        const ip = addr.address;
        if (isPrivateIP(ip)) {
          throw new Error(`SSRF blocked: Hostname resolves to private IP address ${ip}`);
        }
      }
    } catch (err) {
      if (err.message.startsWith("SSRF blocked")) throw err;
      // If DNS lookup fails here, let fetch handle the resolution error normally
    }
  }

  return parsed;
}

function isPrivateIP(ip) {
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip === "127.0.0.1" || ip === "::1") return true;
  if (ip.startsWith("169.254.")) return true;
  // 172.16.0.0 - 172.31.255.255
  if (ip.startsWith("172.")) {
    const parts = ip.split(".");
    const second = parseInt(parts[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

/**
 * Checks an API endpoint and measures latency, status code, and health
 */
export async function checkAPI(monitor) {
  const allowLocal = process.env.ALLOW_LOCALHOST_MONITORING === "true";
  const startTime = Date.now();
  const timeoutMs = Number(monitor.timeout) || 10000;
  const slowThreshold = Number(monitor.slowThreshold) || 2000;

  try {
    // SSRF Check
    await validateUrl(monitor.url, allowLocal);

    const headers = {};
    if (monitor.headers) {
      try {
        const parsed = typeof monitor.headers === "string" ? JSON.parse(monitor.headers) : monitor.headers;
        Object.assign(headers, parsed);
      } catch {
        // invalid headers json, ignore or fallback
      }
    }

    // Authentication Handling (Bearer, Basic, API Key, Cookie, or Dynamic Login)
    if (monitor.authType === "bearer" && monitor.authBearerToken) {
      headers["Authorization"] = `Bearer ${monitor.authBearerToken.trim()}`;
    } else if (monitor.authType === "basic" && monitor.authBasicUser) {
      const basicCredentials = Buffer.from(`${monitor.authBasicUser}:${monitor.authBasicPass || ""}`).toString("base64");
      headers["Authorization"] = `Basic ${basicCredentials}`;
    } else if (monitor.authType === "apiKey" && monitor.authApiKeyHeader) {
      headers[monitor.authApiKeyHeader] = monitor.authApiKeyValue || "";
    } else if (monitor.authType === "cookie" && monitor.authCookie) {
      headers["Cookie"] = monitor.authCookie;
    } else if (monitor.authType === "login_request" && monitor.authLoginUrl) {
      // Dynamic Login Pre-Flight: Authenticates first, extracts token, and passes it to the target
      try {
        await validateUrl(monitor.authLoginUrl, allowLocal);
        let loginBody = monitor.authLoginBody;
        if (typeof loginBody === "string") {
          try { loginBody = JSON.parse(loginBody); } catch {}
        }
        const loginRes = await fetch(monitor.authLoginUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: typeof loginBody === "object" ? JSON.stringify(loginBody) : loginBody,
          signal: AbortSignal.timeout(timeoutMs),
        });
        const loginData = await loginRes.json();
        const extractedToken = loginData.token || loginData.access_token || loginData.jwt || loginData.data?.token;
        if (extractedToken) {
          headers["Authorization"] = `Bearer ${extractedToken}`;
        }
      } catch (authErr) {
        console.warn(`Dynamic login pre-flight failed for ${monitor.name}:`, authErr.message);
      }
    }

    const method = (monitor.method || "GET").toUpperCase();
    const redirectPolicy = monitor.redirectPolicy || (monitor.disallowRedirect ? "manual" : "follow");

    const fetchOptions = {
      method,
      redirect: redirectPolicy === "disallow" ? "manual" : redirectPolicy,
      headers: {
        "User-Agent": "APIWatch-Bot/1.0 (+https://apiwatch.local)",
        ...headers,
      },
      signal: AbortSignal.timeout(timeoutMs),
    };

    if (["POST", "PUT", "PATCH"].includes(method) && monitor.body) {
      fetchOptions.body = typeof monitor.body === "string" ? monitor.body : JSON.stringify(monitor.body);
      if (!headers["Content-Type"]) {
        fetchOptions.headers["Content-Type"] = "application/json";
      }
    }

    // Execute request and trace full redirect chain with codes and hops
    const redirectChain = [];
    let currentUrl = monitor.url;
    let hop = 1;
    const maxHops = 10;
    let response = null;

    while (hop <= maxHops) {
      await validateUrl(currentUrl, allowLocal);
      const hopStart = Date.now();
      const res = await fetch(currentUrl, {
        ...fetchOptions,
        redirect: "manual",
      });
      const hopLatency = Date.now() - hopStart;
      const location = res.headers.get("location");
      const isRedirect = res.status >= 300 && res.status < 400 && location;
      const nextTargetUrl = isRedirect ? new URL(location, currentUrl).href : null;

      redirectChain.push({
        hop,
        statusCode: res.status,
        statusText: res.statusText || (res.status === 301 ? "Moved Permanently" : res.status === 302 ? "Found" : res.status === 307 ? "Temporary Redirect" : res.status === 308 ? "Permanent Redirect" : "OK"),
        url: currentUrl,
        targetUrl: nextTargetUrl,
        latency: hopLatency,
      });

      response = res;

      if (redirectPolicy === "manual" || redirectPolicy === "disallow" || !isRedirect) {
        break;
      }

      currentUrl = nextTargetUrl;
      hop++;
    }

    const responseTime = Date.now() - startTime;
    const finalUrl = response.url || currentUrl;
    const isRedirected = redirectChain.length > 1 || (response.status >= 300 && response.status < 400);
    const locationHeader = response.headers.get("location");

    // Multi-location simulation offsets (Phase 11 enhancement #5)
    // Simulates geographical latency variance across global monitoring nodes
    const regions = {
      "us-east": Math.max(15, Math.round(responseTime * 0.95)),
      "eu-west": Math.max(25, Math.round(responseTime * 1.35)),
      "ap-south": Math.max(35, Math.round(responseTime * 1.6)),
    };

    // Normalizing expected status codes
    let expectedCodes = [200];
    if (Array.isArray(monitor.expectedStatusCodes) && monitor.expectedStatusCodes.length > 0) {
      expectedCodes = monitor.expectedStatusCodes.map(Number);
    } else if (monitor.expectedStatusCode) {
      expectedCodes = [Number(monitor.expectedStatusCode)];
    }

    let isExpectedStatus = expectedCodes.includes(response.status);
    let checkError = null;

    // 1. Check Disallowed Redirects
    if (redirectPolicy === "disallow" && isRedirected) {
      isExpectedStatus = false;
      checkError = `Redirect detected to ${locationHeader || finalUrl} (Redirects disallowed)`;
    } else if (!isExpectedStatus) {
      if (isRedirected) {
        const hopSummary = redirectChain.map((h) => `[${h.statusCode}]`).join(" ➔ ");
        checkError = `Redirect chain ${hopSummary} stopped at HTTP ${response.status} -> ${locationHeader || finalUrl} (Expected ${JSON.stringify(expectedCodes)})`;
      } else {
        checkError = `HTTP status ${response.status} not in expected [${expectedCodes.join(", ")}]`;
      }
    }

    // 2. Keyword & Response Body Assertions (if status code was valid)
    if (isExpectedStatus && monitor.keywordAssertion) {
      try {
        const text = await response.text();
        const keyword = monitor.keywordAssertion.trim();
        const assertionType = monitor.assertionType || "contains";

        if (assertionType === "contains" && !text.includes(keyword)) {
          isExpectedStatus = false;
          checkError = `Assertion failed: Response body did not contain required keyword "${keyword}"`;
        } else if (assertionType === "not_contains" && text.includes(keyword)) {
          isExpectedStatus = false;
          checkError = `Assertion failed: Response body contained forbidden keyword "${keyword}" (Possible login redirect)`;
        }
      } catch (bodyErr) {
        // failed reading body
      }
    }

    let status = "DOWN";
    if (isExpectedStatus) {
      status = responseTime > slowThreshold ? "SLOW" : "UP";
    }

    return {
      status,
      statusCode: response.status,
      responseTime,
      redirected: isRedirected,
      redirectCount: redirectChain.length > 1 ? redirectChain.length - 1 : 0,
      redirectChain, // Full list of all hops with statusCode, url, targetUrl, and latency
      finalUrl,
      redirectLocation: locationHeader,
      regions,
      checkedAt: new Date().toISOString(),
      error: isExpectedStatus ? null : checkError,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    let errorMessage = error.message;

    if (error.name === "TimeoutError" || error.code === 23) {
      errorMessage = `Request timed out after ${timeoutMs}ms`;
    } else if (error.code === "ENOTFOUND") {
      errorMessage = `DNS resolution failed: hostname not found`;
    } else if (error.code === "ECONNREFUSED") {
      errorMessage = `Connection refused by server`;
    }

    return {
      status: "DOWN",
      statusCode: null,
      responseTime,
      checkedAt: new Date().toISOString(),
      error: errorMessage,
    };
  }
}

export default {
  validateUrl,
  checkAPI,
};
