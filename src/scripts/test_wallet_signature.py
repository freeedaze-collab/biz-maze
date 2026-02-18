# src/scripts/test_wallet_signature.py
import requests
import time
from eth_account import Account
from eth_account.messages import encode_defunct

# ==========================================
# [設定エリア]
# ==========================================
# From .env
SUPABASE_URL = "https://yelkjimxejmrkfzeumos.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbGtqaW14ZWptcmtmemV1bW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTgzNjQsImV4cCI6MjA4MTMzNDM2NH0.JO5ZsgYr2OH7sOTJ6cdjDIfLs2Fsi-rlD2atuLcatJs"

# Functions Endpoint
VERIFY_WALLET_URL = f"{SUPABASE_URL}/functions/v1/verify_wallet"

# Test Account (Will try to signup or login)
TEST_EMAIL = f"test_wallet_{int(time.time())}@example.com"
TEST_PASSWORD = "Password123!"
# ==========================================

def get_auth_token():
    print(f"--- 1. Auth Token Retrieval ---")
    headers = {
        "apikey": ANON_KEY,
        "Content-Type": "application/json"
    }
    
    # 1. Signup
    print(f"   Creating test user: {TEST_EMAIL}")
    signup_resp = requests.post(
        f"{SUPABASE_URL}/auth/v1/signup",
        headers=headers,
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    
    if signup_resp.status_code == 200 or signup_resp.status_code == 201:
        data = signup_resp.json()
        token = data.get("access_token")
        if token:
            print("   [OK] Signup Success")
            return token
    else:
        # 2. Try Login (if user exists)
        print(f"   Signup failed (user might exist), trying login...")
        login_resp = requests.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
            headers=headers,
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if login_resp.status_code == 200:
            print("   [OK] Login Success")
            return login_resp.json().get("access_token")
            
    print(f"FAILED Auth Error: {signup_resp.text}")
    return None

def test_evm_verification(token):
    print(f"\n--- 2. EVM Signature Verification Test ---")
    
    # 1. Generate local EVM account
    acct = Account.create()
    my_address = acct.address
    private_key = acct.key.hex()
    print(f"   Test Address: {my_address}")

    # 2. Get Nonce from Edge Function
    headers = {
        "Authorization": f"Bearer {token}",
        "apikey": ANON_KEY,
        "Content-Type": "application/json"
    }
    
    print(f"   Fetching Nonce...")
    nonce_resp = requests.get(VERIFY_WALLET_URL, headers=headers)
    
    if nonce_resp.status_code != 200:
        print(f"FAILED Nonce Fetch Error: {nonce_resp.text}")
        return

    nonce_message = nonce_resp.json().get("nonce")
    print(f"   Received Nonce: '{nonce_message}'")

    # 3. Sign the Nonce
    message_encoded = encode_defunct(text=nonce_message)
    signed_message = Account.sign_message(message_encoded, private_key=private_key)
    signature = signed_message.signature.hex()
    if not signature.startswith("0x"):
        signature = "0x" + signature
    print(f"   Signature generated")

    # 4. Verify via Edge Function
    payload = {
        "address": my_address,
        "signature": signature,
        "message": nonce_message,
        "chain": "evm",
        "walletType": "metamask"
    }
    
    print(f"   Verifying signature...")
    verify_resp = requests.post(VERIFY_WALLET_URL, headers=headers, json=payload)

    if verify_resp.status_code == 200:
        print("SUCCESS [Success] EVM verification passed!")
    else:
        print(f"FAILED [Failure] Verification rejected: {verify_resp.text}")

if __name__ == "__main__":
    jwt = get_auth_token()
    if jwt:
        test_evm_verification(jwt)
