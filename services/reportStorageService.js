import fs from "fs";
import path from "path";
import admin from "firebase-admin";

const DATA_DIR = path.resolve(process.cwd(), ".data");
const REPORTS_DIR = path.join(DATA_DIR, "reports");

// Ensure .data/reports directory exists on initialization
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

/**
 * Gets Firebase Storage bucket if configured and available.
 */
function getStorageBucket() {
  try {
    if (admin.apps && admin.apps.length > 0) {
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET || (process.env.FIREBASE_PROJECT_ID ? `${process.env.FIREBASE_PROJECT_ID}.appspot.com` : null);
      if (bucketName) {
        return admin.storage().bucket(bucketName);
      }
    }
  } catch (err) {
    // Firebase storage not configured or available
  }
  return null;
}

/**
 * Saves a report PDF buffer to persistent storage.
 * Always saves to local persistent directory `.data/reports/${reportId}.pdf`.
 * If Firebase Storage is configured, also uploads to Firebase Storage.
 */
export async function saveReportPdf(reportId, pdfBuffer) {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  const filePath = path.join(REPORTS_DIR, `${reportId}.pdf`);
  fs.writeFileSync(filePath, pdfBuffer);

  let cloudStoragePath = null;
  const bucket = getStorageBucket();
  if (bucket) {
    try {
      const file = bucket.file(`reports/${reportId}.pdf`);
      await file.save(pdfBuffer, {
        contentType: "application/pdf",
        metadata: {
          reportId,
          createdAt: new Date().toISOString(),
        },
      });
      cloudStoragePath = `reports/${reportId}.pdf`;
    } catch (err) {
      console.warn(`Firebase Storage upload skipped for report ${reportId}:`, err.message);
    }
  }

  return {
    localPath: filePath,
    cloudPath: cloudStoragePath,
    size: pdfBuffer.length,
  };
}

/**
 * Checks whether a report PDF exists in persistent storage.
 */
export async function hasReportPdf(reportId) {
  const filePath = path.join(REPORTS_DIR, `${reportId}.pdf`);
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
    return true;
  }

  const bucket = getStorageBucket();
  if (bucket) {
    try {
      const file = bucket.file(`reports/${reportId}.pdf`);
      const [exists] = await file.exists();
      return !!exists;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Retrieves the report PDF buffer from persistent storage.
 */
export async function getReportPdf(reportId) {
  const filePath = path.join(REPORTS_DIR, `${reportId}.pdf`);
  if (fs.existsSync(filePath)) {
    const buf = fs.readFileSync(filePath);
    if (buf.length > 0) return buf;
  }

  const bucket = getStorageBucket();
  if (bucket) {
    try {
      const file = bucket.file(`reports/${reportId}.pdf`);
      const [contents] = await file.download();
      if (contents && contents.length > 0) {
        // Cache locally for faster subsequent access
        try {
          fs.writeFileSync(filePath, contents);
        } catch {}
        return contents;
      }
    } catch (err) {
      console.warn(`Could not fetch PDF from Firebase Storage for ${reportId}:`, err.message);
    }
  }

  return null;
}

export default {
  saveReportPdf,
  hasReportPdf,
  getReportPdf,
};
