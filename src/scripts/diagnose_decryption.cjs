
// src/scripts/diagnose_decryption.cjs
const { decode } = require('base64-arraybuffer'); // We might need a local equivalent or just use Buffer

async function getKey(b64) {
    const raw = Buffer.from(b64, 'base64');
    return await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt", "encrypt"]);
}

async function decryptBlob(blob, kmsKey) {
    const parts = blob.split(":");
    if (parts.length !== 3 || parts[0] !== 'v1') throw new Error("Invalid encrypted blob format.");

    const iv = Buffer.from(parts[1], 'base64');
    const ct = Buffer.from(parts[2], 'base64');

    const key = await getKey(kmsKey);
    try {
        const decryptedData = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
        return JSON.parse(new TextDecoder().decode(decryptedData));
    } catch (e) {
        return { error: e.message };
    }
}

async function run() {
    const kmsKey = "YOUR_KMS_KEY_HERE"; // Fill this if testing locally
    const blob = "YOUR_BLOB_HERE";     // Fill this if testing locally

    // This is for internal reference of logic comparison
    console.log("Logic comparison script ready.");
}

run();
