import { getAdminAuth } from "../config/firebaseAdmin.js";

/**
 * Middleware to verify Firebase Authentication ID tokens.
 * Extracts and verifies the token from "Authorization: Bearer <token>"
 * and attaches req.user and req.userId to the request.
 *
 * Never trusts a client-supplied UID. Always derives the UID from the verified token.
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1]?.trim();
    } else if (req.query?.token) {
      // Support query token parameter for direct browser PDF viewing/downloads
      token = req.query.token.trim();
    }

    if (!token) {
      // In automated test environment, provide default test identity if no auth token was provided
      if (process.env.NODE_ENV === "test") {
        req.user = { uid: "e2e-user", email: "e2e@example.com" };
        req.userId = "e2e-user";
        return next();
      }

      return res.status(401).json({
        success: false,
        error: "Unauthorized: Missing or invalid Authorization header or token. Expected 'Bearer <token>' or '?token=<token>'.",
      });
    }

    // Support simulated test tokens during automated test suite execution
    if (process.env.NODE_ENV === "test" && token.startsWith("test-token:")) {
      const parts = token.split(":");
      const uid = parts[1] || "test-user-1";
      const email = parts[2] || `${uid}@example.com`;
      req.user = { uid, email };
      req.userId = uid;
      return next();
    }

    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      return res.status(500).json({
        success: false,
        error: "Server configuration error: Firebase Admin Auth service is not initialized.",
      });
    }

    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email || null,
        name: decodedToken.name || decodedToken.email?.split("@")[0] || "User",
        ...decodedToken,
      };
      req.userId = decodedToken.uid;
      return next();
    } catch (authErr) {
      console.warn("🔒 Firebase token verification failed:", authErr.message);
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Invalid, malformed, or expired Firebase ID token.",
        code: authErr.code || "auth/invalid-token",
      });
    }
  } catch (err) {
    console.error("requireAuth middleware error:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error during authentication verification.",
    });
  }
}

/**
 * Validates that a resource belongs to the authenticated user.
 * Returns true if owned by req.userId; otherwise sends 403 Forbidden and returns false.
 */
export function validateResourceOwnership(resource, req, res, resourceName = "resource") {
  if (!resource) {
    res.status(404).json({ success: false, error: `${resourceName} not found` });
    return false;
  }

  const resourceOwner = resource.userId;
  if (!resourceOwner || resourceOwner !== req.userId) {
    res.status(403).json({
      success: false,
      error: `Forbidden: You do not have permission to access or modify this ${resourceName}.`,
    });
    return false;
  }

  return true;
}

export default {
  requireAuth,
  validateResourceOwnership,
};
