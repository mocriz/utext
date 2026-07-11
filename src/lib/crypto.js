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

// 5. encrypt binary (foto) — returns base64 ciphertext + nonce
export async function encryptBytes(sharedSecretB64, bytes) {
  await initSodium()
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  const ct = sodium.crypto_secretbox_easy(bytes, nonce, sodium.from_base64(sharedSecretB64))
  return { ciphertext: sodium.to_base64(ct), nonce: sodium.to_base64(nonce) }
}

// 6. decrypt binary (foto)
export async function decryptBytes(sharedSecretB64, ciphertextB64, nonceB64) {
  await initSodium()
  const pt = sodium.crypto_secretbox_open_easy(
    sodium.from_base64(ciphertextB64),
    sodium.from_base64(nonceB64),
    sodium.from_base64(sharedSecretB64)
  )
  // Uint8Array ready untuk di-blob + render
  return pt
}

// 7. SEAL private key dengan passphrase (biar aman disimpan di Drive)
//    pakai argon2id (opslimit sedang) + secretbox
export async function sealPrivateKey(privateKeyB64, passphrase) {
  await initSodium()
  const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES)
  const key = sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES,
    passphrase,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_ARGON2ID13
  )
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  const sealed = sodium.crypto_secretbox_easy(sodium.from_base64(privateKeyB64), nonce, key)
  return {
    v: 1,
    salt: sodium.to_base64(salt),
    nonce: sodium.to_base64(nonce),
    sealed: sodium.to_base64(sealed),
  }
}

// 8. UNSEAL private key dari Drive pakai passphrase
export async function unsealPrivateKey(envelope, passphrase) {
  await initSodium()
  const key = sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES,
    passphrase,
    sodium.from_base64(envelope.salt),
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_ARGON2ID13
  )
  const priv = sodium.crypto_secretbox_open_easy(
    sodium.from_base64(envelope.sealed),
    sodium.from_base64(envelope.nonce),
    key
  )
  return sodium.to_base64(priv)
}
