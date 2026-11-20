import db from "../config/firebaseAdmin.js";

/**
 * GET /api/folders
 * Returns list of distinct folder names for the authenticated user only.
 */
export async function getFolders(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized: Missing user identity" });
    }

    const folderSet = new Set(["General"]);

    // 1. Fetch from folders collection for this user
    try {
      const foldersSnap = await db.collection("folders").where("userId", "==", userId).get();
      foldersSnap.forEach((doc) => {
        const data = doc.data();
        const name = (data?.name || doc.id || "").trim();
        if (name) folderSet.add(name);
      });
    } catch (err) {
      console.warn("Could not read folders collection:", err.message);
    }

    // 2. Fetch from existing monitors owned by this user
    try {
      const monitorsSnap = await db.collection("monitors").where("userId", "==", userId).get();
      monitorsSnap.forEach((doc) => {
        const data = doc.data();
        const f = (data?.folder || "General").trim();
        if (f) folderSet.add(f);
      });
    } catch (err) {
      console.warn("Could not read monitors for folders:", err.message);
    }

    const folders = Array.from(folderSet).sort((a, b) => {
      if (a === "General") return -1;
      if (b === "General") return 1;
      return a.localeCompare(b);
    });

    return res.status(200).json({ success: true, folders });
  } catch (err) {
    console.error("GET /api/folders error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/folders
 * Creates a new folder owned by the authenticated user.
 */
export async function createFolder(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized: Missing user identity" });
    }

    const { name } = req.body;
    const trimmed = (name || "").trim();

    if (!trimmed) {
      return res.status(400).json({ success: false, error: "Folder name is required" });
    }

    const folderDocId = `${userId}_${encodeURIComponent(trimmed)}`;

    // Save into folders collection with user ownership
    await db.collection("folders").doc(folderDocId).set({
      name: trimmed,
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return res.status(201).json({ success: true, folder: trimmed });
  } catch (err) {
    console.error("POST /api/folders error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * DELETE /api/folders/:folderName
 * Deletes a folder and cascade deletes all monitors inside that folder belonging ONLY to the authenticated user.
 */
export async function deleteFolder(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized: Missing user identity" });
    }

    const folderName = decodeURIComponent(req.params.folderName || "").trim();

    if (!folderName) {
      return res.status(400).json({ success: false, error: "Folder name is required" });
    }

    // Find monitors in this folder belonging STRICTLY to this user
    const monitorsSnap = await db.collection("monitors").where("userId", "==", userId).get();
    let deletedCount = 0;

    const monitorDocsToDelete = [];
    monitorsSnap.forEach((doc) => {
      const data = doc.data();
      const f = (data?.folder || "General").trim();
      if (f.toLowerCase() === folderName.toLowerCase()) {
        monitorDocsToDelete.push(doc.id);
      }
    });

    for (const monId of monitorDocsToDelete) {
      await db.collection("monitors").doc(monId).delete();

      try {
        const checksSnap = await db.collection("checks").where("monitorId", "==", monId).get();
        checksSnap.forEach((doc) => db.collection("checks").doc(doc.id).delete());

        const incSnap = await db.collection("incidents").where("monitorId", "==", monId).get();
        incSnap.forEach((doc) => db.collection("incidents").doc(doc.id).delete());
      } catch {
        // ignore cascading errors
      }
      deletedCount++;
    }

    // Remove folder record for this user
    const folderDocId = `${userId}_${encodeURIComponent(folderName)}`;
    try {
      await db.collection("folders").doc(folderDocId).delete();
    } catch {
      // ignore
    }

    return res.status(200).json({
      success: true,
      message: `Deleted folder "${folderName}" and ${deletedCount} associated monitor(s)`,
      deletedMonitorsCount: deletedCount,
    });
  } catch (err) {
    console.error("DELETE /api/folders/:folderName error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export default {
  getFolders,
  createFolder,
  deleteFolder,
};
