# Cipher

Cipher is a browser-based encrypted messaging prototype. Messages are encrypted in the browser and can be delivered directly to another open browser over a peer-to-peer WebRTC data channel, or transferred manually by SMS, QR code, and copy/paste.

## Run locally

Requirements: Node.js and a modern browser with Web Crypto and WebRTC support.

```powershell
node serve.js
```

Open <http://127.0.0.1:4173>. The server binds to loopback, so it is only available on this computer. A secure context (localhost or HTTPS) is required for browser cryptography and service-worker caching. The app has no package installation or build step.

## Start a conversation

1. Choose **New Encrypted Chat**. Enter a contact name and phone number; the phone number is used for SMS handoff and shown with message numbers.
2. The app generates a random shared passkey. Copy it and send it to the other person through a separate private channel. On the other device, create the contact and replace its generated passkey with the exact shared value. Both contacts must use the same passkey.
3. Compare the 60-digit security code in person before sending sensitive messages. It helps detect a mismatched passkey or an intercepted connection setup.
4. For direct delivery, both people open the chat and keep the app running. Choose **Connect devices** on one device, create an invite, and send its connection code privately. The other device pastes the invite and applies it, then returns the generated answer code. The first device pastes and applies that answer. The app reports **Connected** when the peer data channel opens.
5. Compose a message and use the arrow to encrypt it. When directly connected, the receiver decrypts and saves the message before the sender marks it delivered. Without an open direct connection, the encrypted message is saved locally and can be sent using **Send by SMS**, **Show QR**, or **Copy encrypted text**.
6. To read a message received manually, open **Decrypt a message you received**, paste the encrypted text, and choose **Decrypt**.

Message bubbles display the message number, contact phone number, time, and delivery/storage state. Numbering is local to each conversation and is included in the authenticated encrypted message metadata.

## Direct connection limits

Connection setup uses a manual WebRTC offer/answer exchange. It does not use a signaling server, STUN server, or TURN relay. Both devices generally need to be on the same reachable local network, and the network must permit peer-to-peer traffic. Browser privacy settings, firewalls, VPNs, guest Wi-Fi isolation, or network address translation can prevent a connection. Both pages must remain open; closing a page or losing connectivity ends the session. SMS, QR, and copy/paste are the fallbacks.

Connection codes contain temporary network connection details. Share them privately and only with the intended contact. This prototype does not have accounts, a contact directory, server-side message delivery, or a persistent background connection.

## Cryptography and privacy

- Message payloads use the Web Crypto API with AES-256-GCM, a fresh random 96-bit nonce, and a 128-bit authentication tag.
- A 256-bit key is derived from the shared passkey with PBKDF2-HMAC-SHA-512 and 600,000 iterations.
- The authenticated message envelope binds its version and metadata to the ciphertext. Older V1 and V2 messages remain readable.
- WebRTC data channels are protected by WebRTC's DTLS transport; the app also encrypts message contents before sending them through the channel.
- The app stores shared passkeys and readable message history in this browser's local storage. Anyone with access to the unlocked browser profile can read them. Clearing site data deletes saved contacts and messages.
- AES-GCM detects tampering, but a shared passkey alone does not establish a person's identity. Verify the security code through a trusted, in-person channel. SMS does not authenticate its sender.

This is a prototype, not a professionally audited secure messenger. Do not rely on it for high-risk communications. SMS carriers may split long ciphertexts across multiple parts or charge for them.

## Project files

- `index.html`, `style.css`: app structure and responsive interface.
- `app.js`: contacts, local persistence, message UI, and peer connection flow.
- `crypto-engine.js`: message encryption, decryption, and security fingerprints.
- `qr-helper.js`: QR code rendering.
- `audio-fx.js`: optional audio feedback.
- `serve.js`: dependency-free local development server.
- `service-worker.js`: offline asset caching.

## Development

There is no build system or automated test suite configured. Run `node serve.js` and verify the message and peer-connection flows in a modern browser. For a direct-connection check, use two browser tabs on the same computer; for real device-to-device use, test on the target local network.
