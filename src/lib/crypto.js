// src/lib/crypto.js  (butuh: npm install libsodium-wrappers)
import sodium from 'libsodium-wrappers'
import { supabase } from './supabase'

let ready = false
export async function initSodium() {
  if (!ready) { await sodium.ready; ready = true }
}

// 1. generate keypair (X25519) — private ga pernah keluar browser
export async function generateKeypair() {
  await initSodium()
  const kp = sodium.crypto_box_keypair()
  return {
    publicKey: sodium.to_base64(kp.publicKey),
    privateKey: sodium.to_base64(kp.privateKey), // RAHASIA
  }
}

// 2. derive shared secret (ECDH) → AES key
export async function deriveSharedSecret(myPrivateB64, theirPublicB64) {
  await initSodium()
  const shared = sodium.crypto_scalarmult(
    sodium.from_base64(myPrivateB64),
    sodium.from_base64(theirPublicB64)
  )
  return sodium.to_base64(shared)
}

// 3. encrypt text
export async function encryptText(sharedSecretB64, plaintext) {
  await initSodium()
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  const ct = sodium.crypto_secretbox_easy(
    sodium.from_string(plaintext),
    nonce,
    sodium.from_base64(sharedSecretB64)
  )
  return { ciphertext: sodium.to_base64(ct), nonce: sodium.to_base64(nonce) }
}

// 4. decrypt text
export async function decryptText(sharedSecretB64, ciphertextB64, nonceB64) {
  await initSodium()
  const pt = sodium.crypto_secretbox_open_easy(
    sodium.from_base64(ciphertextB64),
    sodium.from_base64(nonceB64),
    sodium.from_base64(sharedSecretB64)
  )
  return sodium.to_string(pt)
}
