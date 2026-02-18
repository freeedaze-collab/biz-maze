// src/scripts/test_btc_logic.cjs
const { Verifier } = require('bip322-js');

// Official BIP-322 Test Vector
const address = 'bc1q9vza2e8x573nczrlzms0wvx3gsqjx7vavgkx0l';
const message = '';
const signature = 'AkcwRAIgM2gBAQqvZX15ZiysmKmQpDrG83avLIT492QBzLnQIxYCIBaTpOaD20qRlEylyxFSeEA2ba9YOixpX8z46TSDtS40ASECx/EgAxlkQpQ9hYjgGu6EBCPMVPwVIVJqO4XCsMvViHI=';

console.log("--- Bitcoin BIP-322 Logic Verification ---");
console.log(`Testing Address: ${address}`);
console.log(`Testing Message: "${message}"`);

try {
    const isValid = Verifier.verifySignature(address, message, signature);
    if (isValid) {
        console.log("✅ SUCCESS: BIP-322 verification worked with the test vector!");
    } else {
        console.log("❌ FAILED: Verification returned false.");
    }
    process.exit(isValid ? 0 : 1);
} catch (e) {
    console.error("❌ CRASHED: Verification logic threw an error:", e);
    process.exit(1);
}
