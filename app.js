/**
 * CIPHER_TXT // ULTRA-MODERN CONTROLLER
 * High-performance state controller with 600K PBKDF2 AES-256-GCM encryption,
 * contact phone number linking, and modern conversational UI.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const cryptoEngine = new CryptoEngine();
  const soundFX = new SoundFX();

  // New installs start empty. Example contacts with public, hard-coded keys
  // would make the encryption appear safer than it is.
  const DEFAULT_CONTACTS = [];

  // State
  let contacts = [];
  try {
    const savedContacts = localStorage.getItem('modern_contacts_v2');
    const parsedContacts = savedContacts ? JSON.parse(savedContacts) : DEFAULT_CONTACTS;
    contacts = Array.isArray(parsedContacts) ? parsedContacts : DEFAULT_CONTACTS;
  } catch (_) {
    contacts = DEFAULT_CONTACTS;
  }

  let activeContactId = null;
  let isEncrypting = false;
  let peerConnection = null;
  let peerDataChannel = null;
  const pendingPeerDeliveries = new Map();
  try {
    activeContactId = localStorage.getItem('modern_active_contact_id') || contacts[0]?.id || null;
  } catch (_) {
    activeContactId = contacts[0]?.id || null;
  }
  
  let allMessages = {};
  try {
    const savedMsgs = localStorage.getItem('modern_messages_v2');
    const parsedMessages = savedMsgs ? JSON.parse(savedMsgs) : {};
    allMessages = parsedMessages && typeof parsedMessages === 'object' && !Array.isArray(parsedMessages) ? parsedMessages : {};
  } catch (_) {
    allMessages = {};
  }

  // UI Elements
  const chatsListEl = document.getElementById('chats-list');
  const searchInputEl = document.getElementById('search-input');
  const messagesContainerEl = document.getElementById('messages-container');
  const conversationPaneEl = document.getElementById('conversation-pane');

  const activeAvatarEl = document.getElementById('active-chat-avatar');
  const activeNameEl = document.getElementById('active-chat-name');
  const activePhoneEl = document.getElementById('active-chat-phone');
  const e2eeContactNameEl = document.getElementById('e2ee-contact-name');

  const composerInputEl = document.getElementById('composer-input');
  const composerCharBadgeEl = document.getElementById('composer-char-badge');
  const btnComposerSend = document.getElementById('btn-composer-send');
  const btnComposerSendSms = document.getElementById('btn-composer-send-sms');
  const btnComposerQr = document.getElementById('btn-composer-qr');

  const inboundInputEl = document.getElementById('inbound-sms-input');
  const btnDecryptInbound = document.getElementById('btn-decrypt-inbound');
  const btnPasteClipboard = document.getElementById('btn-paste-clipboard');

  const btnMobileBack = document.getElementById('btn-mobile-back');
  const btnVerifySecurity = document.getElementById('btn-verify-security');
  const btnP2pConnect = document.getElementById('btn-p2p-connect');
  const bannerE2ee = document.getElementById('banner-e2ee');
  const headerContactInfo = document.getElementById('header-contact-info');

  const btnToggleTheme = document.getElementById('btn-toggle-theme');
  const btnToggleAudio = document.getElementById('btn-toggle-audio');
  const audioIconSvg = document.getElementById('audio-icon-svg');
  const btnNewChatTop = document.getElementById('btn-new-chat-top');
  const fabNewChat = document.getElementById('fab-new-chat');

  // Modals
  const modalSecurityCode = document.getElementById('modal-security-code');
  const modalPeerConnect = document.getElementById('modal-peer-connect');
  const peerSignalInput = document.getElementById('peer-signal-input');
  const peerConnectStatus = document.getElementById('peer-connect-status');
  const btnPeerCreateOffer = document.getElementById('btn-peer-create-offer');
  const btnPeerCopyCode = document.getElementById('btn-peer-copy-code');
  const btnPeerApplyCode = document.getElementById('btn-peer-apply-code');
  const verifyModalName = document.getElementById('verify-modal-name');
  const verifyModalPhone = document.getElementById('verify-modal-phone');
  const securityDigitsContainer = document.getElementById('security-digits-container');
  const securityQrCanvas = document.getElementById('security-qr-canvas');
  const contactSecretKeyInput = document.getElementById('contact-secret-key-input');
  const btnSaveContactKey = document.getElementById('btn-save-contact-key');

  const modalNewContact = document.getElementById('modal-new-contact');
  const newContactName = document.getElementById('new-contact-name');
  const newContactPhone = document.getElementById('new-contact-phone');
  const newContactKey = document.getElementById('new-contact-key');
  const btnCopyContactKey = document.getElementById('btn-copy-contact-key');
  const btnCreateContact = document.getElementById('btn-create-contact');

  const modalAirgapQr = document.getElementById('modal-airgap-qr');
  const airgapQrCanvas = document.getElementById('airgap-qr-canvas');
  const airgapArmoredText = document.getElementById('airgap-armored-text');
  const airgapMetaTag = document.getElementById('airgap-meta-tag');
  const btnCopyAirgapCipher = document.getElementById('btn-copy-airgap-cipher');

  // Helpers
  function getActiveContact() {
    return contacts.find(c => c.id === activeContactId) || contacts[0] || null;
  }

  function saveContacts() {
    try {
      localStorage.setItem('modern_contacts_v2', JSON.stringify(contacts));
      return true;
    } catch (_) {
      showToast('BROWSER COULD NOT SAVE CONTACTS. CHECK AVAILABLE STORAGE.');
      return false;
    }
  }

  function saveMessages() {
    try {
      localStorage.setItem('modern_messages_v2', JSON.stringify(allMessages));
      return true;
    } catch (_) {
      showToast('BROWSER COULD NOT SAVE MESSAGES. CHECK AVAILABLE STORAGE.');
      return false;
    }
  }

  function showToast(text, duration = 2400) {
    const root = document.getElementById('toast-root');
    const toast = document.createElement('div');
    toast.className = 'toast-floating-modern';
    toast.innerHTML = `
      <svg style="width:16px;height:16px;stroke:#00f0ff;stroke-width:2.2;fill:none;" viewBox="0 0 24 24">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      </svg>
      <span>${escapeHtml(text)}</span>
    `;
    root.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translate(-50%, 10px)';
      toast.style.transition = 'all 0.2s';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Render Sidebar Contacts List
  function renderChatsList() {
    const query = searchInputEl.value.trim().toLowerCase();
    chatsListEl.innerHTML = '';

    const filtered = contacts.filter(c => 
      c.name.toLowerCase().includes(query) || c.phone.includes(query)
    );

    if (filtered.length === 0) {
      chatsListEl.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
          No matching encrypted contacts.
        </div>
      `;
      return;
    }

    filtered.forEach(contact => {
      const msgs = allMessages[contact.id] || [];
      const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
      const snippet = lastMsg ? lastMsg.text : 'Secure channel ready';
      const timeStr = lastMsg ? formatTime(lastMsg.timestamp) : '';
      const isActive = contact.id === activeContactId;

      const item = document.createElement('div');
      item.className = `contact-card-modern ${isActive ? 'active' : ''}`;
      item.onclick = () => {
        soundFX.tap();
        activeContactId = contact.id;
        localStorage.setItem('modern_active_contact_id', activeContactId);
        renderChatsList();
        renderActiveChat();
        conversationPaneEl.classList.add('active-mobile');
      };

      item.innerHTML = `
        <div class="contact-avatar-box">
          <div class="avatar-circle-modern">${escapeHtml(contact.avatar)}</div>
        </div>
        <div class="contact-details-box">
          <div class="contact-top-line">
            <span class="contact-name-heading">${escapeHtml(contact.name)}</span>
            <span class="contact-time-stamp">${escapeHtml(timeStr)}</span>
          </div>
          <div class="contact-bottom-line">
            <span class="contact-snippet-text">${escapeHtml(snippet)}</span>
            <span class="contact-phone-tag">${escapeHtml(contact.phone)}</span>
          </div>
        </div>
      `;

      chatsListEl.appendChild(item);
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
  }

  // Render Conversation Pane for Active Contact
  function renderActiveChat() {
    const contact = getActiveContact();
    if (!contact) {
      [composerInputEl, btnComposerSend, btnComposerSendSms, btnComposerQr, inboundInputEl, btnDecryptInbound, btnPasteClipboard, btnP2pConnect].forEach(control => {
        control.disabled = true;
      });
      activeAvatarEl.textContent = '?';
      activeNameEl.textContent = 'No conversation selected';
      activePhoneEl.textContent = '';
      e2eeContactNameEl.textContent = 'your contact';
      messagesContainerEl.innerHTML = '<div class="empty-conversation"><strong>Your messages stay on this device.</strong><span>Add a contact to create a shared key, then encrypt a message or decrypt one you received.</span><button type="button" class="btn-pill-modern btn-pill-highlight" id="btn-empty-add-contact">Add a contact</button></div>';
      document.getElementById('btn-empty-add-contact').addEventListener('click', openNewContactModal);
      return;
    }
    [composerInputEl, btnComposerSend, btnComposerSendSms, btnComposerQr, inboundInputEl, btnDecryptInbound, btnPasteClipboard, btnP2pConnect].forEach(control => {
      control.disabled = false;
    });
    activeAvatarEl.textContent = contact.avatar;
    activeNameEl.textContent = contact.name;
    activePhoneEl.textContent = contact.phone;
    e2eeContactNameEl.textContent = contact.name;

    messagesContainerEl.innerHTML = '';

    // Modern Date Badge
    const dateDiv = document.createElement('div');
    dateDiv.className = 'timeline-date-divider';
    dateDiv.textContent = 'ENCRYPTED MESSAGE HISTORY';
    messagesContainerEl.appendChild(dateDiv);

    const msgs = allMessages[contact.id] || [];
    msgs.forEach((msg, index) => {
      const row = document.createElement('div');
      row.className = `chat-row-modern ${msg.outgoing ? 'outgoing' : 'incoming'}`;

      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble-modern';

      const textEl = document.createElement('div');
      textEl.className = 'bubble-text-content';
      textEl.textContent = msg.text;
      bubble.appendChild(textEl);

      const footer = document.createElement('div');
      footer.className = 'bubble-meta-footer';
      const messageNumber = Number.isInteger(msg.sequence) && msg.sequence > 0 ? msg.sequence : index + 1;
      footer.innerHTML = `
        <span>#${String(messageNumber).padStart(4, '0')}</span>
        <span>${escapeHtml(contact.phone)}</span>
        <span>${formatTime(msg.timestamp)}</span>
        <span>${msg.delivered ? 'Delivered directly' : msg.deliveryState === 'sending' ? 'Sending directly...' : msg.deliveryState === 'unconfirmed' ? 'Delivery unconfirmed' : msg.outgoing ? 'Saved on this device' : 'Decrypted on this device'}</span>
      `;
      bubble.appendChild(footer);

      // Raw Cipher Inspector
      const inspector = document.createElement('div');
      inspector.className = 'bubble-cipher-details';
      inspector.innerHTML = `
        <div style="font-weight:600; color:var(--accent-cyan);">Encrypted message text</div>
        <div class="cipher-code-container">${escapeHtml(msg.armored)}</div>
      `;
      bubble.appendChild(inspector);

      // Quick Tools Tray
      const tools = document.createElement('div');
      tools.className = 'bubble-tools-tray';

      const btnRaw = document.createElement('button');
      btnRaw.className = 'bubble-tool-pill';
      btnRaw.textContent = 'Encrypted text';
      btnRaw.onclick = (e) => {
        e.stopPropagation();
        soundFX.tap();
        inspector.style.display = inspector.style.display === 'block' ? 'none' : 'block';
      };
      tools.appendChild(btnRaw);

      const btnCopy = document.createElement('button');
      btnCopy.className = 'bubble-tool-pill';
      btnCopy.textContent = 'Copy encrypted text';
      btnCopy.onclick = async (e) => {
        e.stopPropagation();
        soundFX.tap();
        try {
          await navigator.clipboard.writeText(msg.armored);
          showToast('COPIED ENCRYPTED MESSAGE');
        } catch (_) {
          inspector.style.display = 'block';
          showToast('OPEN ENCRYPTED TEXT AND COPY IT MANUALLY');
        }
      };
      tools.appendChild(btnCopy);

      const btnQr = document.createElement('button');
      btnQr.className = 'bubble-tool-pill';
      btnQr.textContent = 'Show QR';
      btnQr.onclick = (e) => {
        e.stopPropagation();
        soundFX.tap();
        openAirgapModal(msg.armored);
      };
      tools.appendChild(btnQr);

      bubble.appendChild(tools);
      row.appendChild(bubble);
      messagesContainerEl.appendChild(row);
    });

    messagesContainerEl.scrollTop = messagesContainerEl.scrollHeight;
  }

  // Composer Input Telemetry
  composerInputEl.addEventListener('input', () => {
    const len = composerInputEl.value.length;
    composerCharBadgeEl.textContent = `${len} characters`;
  });

  composerInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  function createPeerConnection() {
    if (!window.RTCPeerConnection || !window.isSecureContext) {
      throw new Error('Direct connections require a modern browser on localhost or HTTPS.');
    }

    if (peerConnection) peerConnection.close();
    peerConnection = new RTCPeerConnection({ iceServers: [] });
    peerDataChannel = null;
    peerConnection.ondatachannel = event => {
      peerDataChannel = event.channel;
      configurePeerDataChannel(peerDataChannel);
    };
    peerConnection.onconnectionstatechange = () => {
      const connected = peerConnection && peerConnection.connectionState === 'connected';
      btnP2pConnect.textContent = connected ? 'Connected' : 'Connect devices';
      if (peerConnection && ['failed', 'disconnected', 'closed'].includes(peerConnection.connectionState)) {
        peerConnectStatus.textContent = 'Direct connection is not active. Check both devices are on the same local network and exchange fresh connection codes.';
      }
    };
    return peerConnection;
  }

  function configurePeerDataChannel(channel) {
    channel.onopen = () => {
      btnP2pConnect.textContent = 'Connected';
      peerConnectStatus.textContent = 'Direct encrypted connection established. Messages sent with the arrow are delivered to this device.';
      showToast('DIRECT DEVICE CONNECTION READY');
    };
    channel.onclose = () => {
      btnP2pConnect.textContent = 'Connect devices';
      peerConnectStatus.textContent = 'Direct connection closed. Create a fresh invite to reconnect.';
    };
    channel.onerror = () => showToast('DIRECT CONNECTION ERROR');
    channel.onmessage = event => {
      let packet;
      try {
        packet = JSON.parse(String(event.data));
      } catch (_) {
        peerConnectStatus.textContent = 'Received an invalid direct-message packet.';
        return;
      }
      if (packet.type === 'ack' && typeof packet.mid === 'string') {
        confirmPeerDelivery(packet.mid);
      } else if (packet.type === 'message' && typeof packet.armored === 'string') {
        receivePeerMessage(packet.armored, channel, packet.mid);
      }
    };
  }

  function waitForIceGathering(connection) {
    if (connection.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise(resolve => {
      const timeout = setTimeout(() => {
        connection.removeEventListener('icegatheringstatechange', onStateChange);
        resolve();
      }, 12000);
      const onStateChange = () => {
        if (connection.iceGatheringState !== 'complete') return;
        clearTimeout(timeout);
        connection.removeEventListener('icegatheringstatechange', onStateChange);
        resolve();
      };
      connection.addEventListener('icegatheringstatechange', onStateChange);
    });
  }

  btnP2pConnect.addEventListener('click', () => {
    if (!getActiveContact()) return showToast('CREATE A CHAT BEFORE CONNECTING');
    if (peerDataChannel && peerDataChannel.readyState === 'open') {
      peerConnectStatus.textContent = 'Direct encrypted connection is active. Messages sent with the arrow go straight to this device.';
    } else {
      peerConnectStatus.textContent = 'Both devices need this app open on the same local network. Exchange the connection code and use the same private passkey. No relay server is used.';
    }
    modalPeerConnect.classList.add('open');
  });

  btnPeerCreateOffer.addEventListener('click', async () => {
    try {
      peerConnectStatus.textContent = 'Creating a local invite and gathering network details...';
      const connection = createPeerConnection();
      peerDataChannel = connection.createDataChannel('cipher-messages');
      configurePeerDataChannel(peerDataChannel);
      await connection.setLocalDescription(await connection.createOffer());
      await waitForIceGathering(connection);
      peerSignalInput.value = JSON.stringify({ type: 'offer', sdp: connection.localDescription.sdp });
      peerConnectStatus.textContent = 'Send this invite privately to the other device. They paste it here, choose Apply code, then send their answer code back to you.';
    } catch (error) {
      peerConnectStatus.textContent = error.message;
    }
  });

  btnPeerCopyCode.addEventListener('click', async () => {
    if (!peerSignalInput.value.trim()) return showToast('CREATE OR PASTE A CONNECTION CODE FIRST');
    try {
      await navigator.clipboard.writeText(peerSignalInput.value);
      showToast('CONNECTION CODE COPIED. SHARE IT PRIVATELY.');
    } catch (_) {
      peerSignalInput.focus();
      peerSignalInput.select();
      showToast('SELECTED. COPY THE CONNECTION CODE MANUALLY.');
    }
  });

  btnPeerApplyCode.addEventListener('click', async () => {
    try {
      const signal = JSON.parse(peerSignalInput.value.trim());
      if (!['offer', 'answer'].includes(signal.type) || typeof signal.sdp !== 'string') {
        throw new Error('That connection code is not a valid offer or answer.');
      }

      if (signal.type === 'offer') {
        const connection = createPeerConnection();
        await connection.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
        await connection.setLocalDescription(await connection.createAnswer());
        await waitForIceGathering(connection);
        peerSignalInput.value = JSON.stringify({ type: 'answer', sdp: connection.localDescription.sdp });
        peerConnectStatus.textContent = 'Send this answer privately back to the person who created the invite. Keep this window open while they apply it.';
      } else {
        if (!peerConnection || peerConnection.localDescription?.type !== 'offer') {
          throw new Error('Create an invite on this device before applying an answer.');
        }
        await peerConnection.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
        peerConnectStatus.textContent = 'Answer applied. Waiting for the other device to connect...';
      }
    } catch (error) {
      peerConnectStatus.textContent = error instanceof SyntaxError ? 'Paste the full connection code first.' : error.message;
    }
  });

  function confirmPeerDelivery(mid) {
    const timeout = pendingPeerDeliveries.get(mid);
    if (timeout) clearTimeout(timeout);
    pendingPeerDeliveries.delete(mid);
    const message = Object.values(allMessages).flat().find(item => item.messageId === mid && item.outgoing);
    if (!message) return;
    message.delivered = true;
    message.deliveryState = 'delivered';
    saveMessages();
    renderChatsList();
    renderActiveChat();
    showToast('DIRECT MESSAGE RECEIVED AND CONFIRMED');
  }

  async function receivePeerMessage(armored, channel, expectedMid) {
    peerConnectStatus.textContent = 'Direct message received; authenticating with the shared passkey...';
    let matchedContact = null;
    let result = null;
    for (const contact of contacts) {
      const attempt = await cryptoEngine.decrypt(armored, contact.secretKey);
      if (attempt.success) {
        matchedContact = contact;
        result = attempt;
        break;
      }
    }
    if (!matchedContact || !result) {
      peerConnectStatus.textContent = 'Direct message failed authentication. Check the shared passkey and compare its security code in person.';
      showToast('DIRECT MESSAGE FAILED AUTHENTICATION');
      return;
    }
    if (expectedMid && expectedMid !== result.mid) {
      peerConnectStatus.textContent = 'Direct message identifier did not match its encrypted payload.';
      showToast('DIRECT MESSAGE FAILED INTEGRITY CHECK');
      return;
    }

    if (!allMessages[matchedContact.id]) allMessages[matchedContact.id] = [];
    allMessages[matchedContact.id].push({
      id: 'msg_' + Date.now(),
      outgoing: false,
      text: result.plaintext,
      timestamp: result.timestamp || Date.now(),
      sequence: result.seq,
      messageId: result.mid,
      checksum: result.checksum,
      armored,
      delivered: true,
      deliveryState: 'delivered'
    });
    activeContactId = matchedContact.id;
    localStorage.setItem('modern_active_contact_id', activeContactId);
    if (!saveMessages()) return;
    renderChatsList();
    renderActiveChat();
    if (channel.readyState === 'open') channel.send(JSON.stringify({ type: 'ack', mid: result.mid }));
    peerConnectStatus.textContent = `Encrypted message received from ${matchedContact.name} and saved on this device.`;
    showToast(`DIRECT MESSAGE RECEIVED FROM ${matchedContact.name.toUpperCase()}`);
  }

  // Send Encrypted Message
  async function sendMessage({ deliverPeer = true } = {}) {
    if (isEncrypting) return null;
    const text = composerInputEl.value.trim();
    if (!text) return;

    const contact = getActiveContact();
    if (!contact) {
      showToast('ADD A CONTACT BEFORE ENCRYPTING');
      return null;
    }
    isEncrypting = true;
    composerInputEl.disabled = true;
    btnComposerSend.disabled = true;
    btnComposerSendSms.disabled = true;
    composerCharBadgeEl.textContent = 'Encrypting securely...';
    try {
      soundFX.encrypt();
      const previousOutgoing = (allMessages[contact.id] || []).filter(msg => msg.outgoing);
      const sequence = previousOutgoing.reduce((highest, msg) => Math.max(highest, Number(msg.sequence) || 0), 0) + 1;
      const enc = await cryptoEngine.encrypt(text, contact.secretKey, { seq: sequence, contactId: contact.id });

      if (!allMessages[contact.id]) allMessages[contact.id] = [];
      const newMsg = {
        id: 'msg_' + Date.now(),
        outgoing: true,
        text: text,
        timestamp: Date.now(),
        sequence: enc.seq,
        messageId: enc.mid,
        checksum: enc.shortSum,
        armored: enc.armored
      };

      allMessages[contact.id].push(newMsg);
      if (!saveMessages()) {
        allMessages[contact.id].pop();
        return null;
      }

      if (deliverPeer && peerDataChannel && peerDataChannel.readyState === 'open') {
        try {
          newMsg.deliveryState = 'sending';
          peerDataChannel.send(JSON.stringify({ type: 'message', mid: enc.mid, armored: enc.armored }));
          const timeout = setTimeout(() => {
            pendingPeerDeliveries.delete(enc.mid);
            const stillPending = (allMessages[contact.id] || []).find(message => message.messageId === enc.mid);
            if (!stillPending || stillPending.delivered) return;
            stillPending.deliveryState = 'unconfirmed';
            saveMessages();
            renderActiveChat();
            showToast('DIRECT MESSAGE DELIVERY WAS NOT CONFIRMED');
          }, 20000);
          pendingPeerDeliveries.set(enc.mid, timeout);
        } catch (_) {
          newMsg.deliveryState = 'unconfirmed';
          showToast('MESSAGE SAVED HERE, BUT DIRECT CONNECTION FAILED');
        }
      }

      composerInputEl.value = '';
      composerCharBadgeEl.textContent = '0 characters';
      renderChatsList();
      renderActiveChat();

      showToast(newMsg.deliveryState === 'sending' ? 'ENCRYPTED MESSAGE SENDING DIRECTLY...' : `ENCRYPTED AND SAVED HERE. SMS USES ${enc.smsSegments} PART${enc.smsSegments === 1 ? '' : 'S'}.`, 4200);
      return newMsg;
    } catch (err) {
      soundFX.error();
      showToast('ENCRYPTION ERROR: ' + err.message);
      return null;
    } finally {
      isEncrypting = false;
      composerInputEl.disabled = false;
      btnComposerSend.disabled = false;
      btnComposerSendSms.disabled = false;
      composerCharBadgeEl.textContent = `${composerInputEl.value.length} characters`;
    }
  }

  btnComposerSend.addEventListener('click', sendMessage);

  // Send via SMS Directly Linked with Phone Number
  async function launchSmsForContact() {
    soundFX.tap();
    const contact = getActiveContact();
    if (!contact) return showToast('ADD A CONTACT FIRST');
    const msg = await sendMessage({ deliverPeer: false });
    if (!msg) return;

    const cleanPhone = contact.phone.replace(/[^0-9+]/g, '');
    const smsUri = `sms:${cleanPhone}?body=${encodeURIComponent(msg.armored)}`;
    
    showToast(`OPENING PHONE SMS TO ${contact.phone}...`);
    window.location.href = smsUri;
  }

  btnComposerSendSms.addEventListener('click', launchSmsForContact);

  // Airgap QR Code Modal
  function openAirgapModal(armoredText) {
    airgapArmoredText.value = armoredText;
    airgapMetaTag.textContent = `Encrypted message • ${armoredText.length} characters`;

    QRCode.drawCanvas(airgapQrCanvas, armoredText, {
      size: 240,
      margin: 2,
      foreground: '#000000',
      background: '#FFFFFF'
    });

    modalAirgapQr.classList.add('open');
  }

  function showLatestQr() {
    soundFX.tap();
    const contact = getActiveContact();
    if (!contact) return showToast('ADD A CONTACT FIRST');
    const msgs = allMessages[contact.id] || [];
    if (msgs.length > 0) {
      const last = msgs[msgs.length - 1];
      openAirgapModal(last.armored);
    } else {
      showToast('NO MESSAGES YET FOR QR AIRGAP');
    }
  }

  btnComposerQr.addEventListener('click', showLatestQr);

  btnCopyAirgapCipher.addEventListener('click', async () => {
    soundFX.tap();
    try {
      await navigator.clipboard.writeText(airgapArmoredText.value);
      showToast('COPIED ENCRYPTED MESSAGE');
    } catch (_) {
      airgapArmoredText.focus();
      airgapArmoredText.select();
      showToast('SELECTED. COPY WITH CTRL+C');
    }
  });

  // Inbound SMS Decryption
  async function decryptInboundPayload(payload) {
    if (!payload || !payload.trim()) {
      showToast('PASTE AN ENCRYPTED SMS FIRST');
      return;
    }

    soundFX.tap();
    const clean = payload.trim();
    
    let contact = getActiveContact();
    if (!contact) return showToast('ADD A CONTACT BEFORE DECRYPTING');
    let res = await cryptoEngine.decrypt(clean, contact.secretKey);

    if (!res.success) {
      for (let c of contacts) {
        if (c.id === contact.id) continue;
        const testRes = await cryptoEngine.decrypt(clean, c.secretKey);
        if (testRes.success) {
          contact = c;
          res = testRes;
          activeContactId = c.id;
          localStorage.setItem('modern_active_contact_id', activeContactId);
          break;
        }
      }
    }

    if (res.success) {
      if (!allMessages[contact.id]) allMessages[contact.id] = [];
      allMessages[contact.id].push({
        id: 'msg_' + Date.now(),
        outgoing: false,
        text: res.plaintext,
        timestamp: Date.now(),
        sequence: res.seq,
        messageId: res.mid,
        checksum: res.checksum,
        armored: clean
      });

      if (!saveMessages()) {
        allMessages[contact.id].pop();
        return;
      }
      renderChatsList();
      renderActiveChat();
      inboundInputEl.value = '';
      soundFX.decrypt();
      showToast(`MESSAGE DECRYPTED USING ${contact.name.toUpperCase()}'S SHARED KEY`);
    } else {
      soundFX.error();
      showToast('AUTHENTICATION FAILED: WRONG KEY OR TAMPERED');
    }
  }

  btnDecryptInbound.addEventListener('click', () => {
    decryptInboundPayload(inboundInputEl.value);
  });

  inboundInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') decryptInboundPayload(inboundInputEl.value);
  });

  btnPasteClipboard.addEventListener('click', async () => {
    soundFX.tap();
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        inboundInputEl.value = text;
        decryptInboundPayload(text);
      }
    } catch (_) {
      showToast('PASTE DIRECTLY USING CTRL+V');
    }
  });

  // Verify Security Code Modal (60-digit WhatsApp/Signal format)
  async function openSecurityCodeModal() {
    soundFX.tap();
    const contact = getActiveContact();
    if (!contact) return showToast('ADD A CONTACT FIRST');
    verifyModalName.textContent = contact.name;
    verifyModalPhone.textContent = contact.phone;
    contactSecretKeyInput.value = contact.secretKey;

    const fp = await cryptoEngine.getSafetyFingerprint(contact.secretKey);
    if (!fp) return;

    securityDigitsContainer.innerHTML = '';
    fp.blocks.forEach(block => {
      const div = document.createElement('div');
      div.className = 'digit-block-badge';
      div.textContent = block;
      securityDigitsContainer.appendChild(div);
    });

    const qrPayload = `SEC60#${contact.phone}#${fp.safetyNumber.replace(/\s+/g, '')}`;
    QRCode.drawCanvas(securityQrCanvas, qrPayload, {
      size: 200,
      margin: 1,
      foreground: '#000000',
      background: '#FFFFFF'
    });

    modalSecurityCode.classList.add('open');
  }

  btnVerifySecurity.addEventListener('click', openSecurityCodeModal);
  bannerE2ee.addEventListener('click', openSecurityCodeModal);
  headerContactInfo.addEventListener('click', openSecurityCodeModal);

  // Update Contact Secret Key
  btnSaveContactKey.addEventListener('click', async () => {
    soundFX.tap();
    const newK = contactSecretKeyInput.value.trim();
    if (!newK) {
      showToast('KEY CANNOT BE EMPTY');
      return;
    }
    const contact = getActiveContact();
    const oldKey = contact.secretKey;
    contact.secretKey = newK;
    if (!saveContacts()) {
      contact.secretKey = oldKey;
      return;
    }
    await openSecurityCodeModal();
    showToast('SHARED SECRET UPDATED');
  });

  // Add New Contact Modal
  function openNewContactModal() {
    soundFX.tap();
    newContactName.value = '';
    newContactPhone.value = '';
    newContactKey.value = cryptoEngine.generatePassphrase();
    modalNewContact.classList.add('open');
  }

  btnNewChatTop.addEventListener('click', openNewContactModal);
  fabNewChat.addEventListener('click', openNewContactModal);

  btnCopyContactKey.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(newContactKey.value);
      showToast('SHARED SECRET COPIED. SEND IT PRIVATELY.');
    } catch (_) {
      newContactKey.focus();
      newContactKey.select();
      showToast('SELECTED. COPY WITH CTRL+C, THEN SHARE PRIVATELY.');
    }
  });

  btnCreateContact.addEventListener('click', () => {
    soundFX.tap();
    const name = newContactName.value.trim();
    const phone = newContactPhone.value.trim();
    let key = newContactKey.value.trim();

    if (!name || !phone || phone.replace(/\D/g, '').length < 7) {
      showToast('ENTER A NAME AND A PHONE NUMBER WITH AT LEAST 7 DIGITS');
      return;
    }

    if (!key) key = cryptoEngine.generatePassphrase();

    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';
    const newContact = {
      id: 'contact_' + Date.now(),
      name: name,
      phone: phone,
      secretKey: key,
      avatar: initials,
      lastSeen: null
    };

    contacts.unshift(newContact);
    activeContactId = newContact.id;
    if (!saveContacts()) {
      contacts.shift();
      activeContactId = contacts[0]?.id || null;
      renderChatsList();
      renderActiveChat();
      return;
    }
    modalNewContact.classList.remove('open');
    renderChatsList();
    renderActiveChat();
    conversationPaneEl.classList.add('active-mobile');
    showToast(`CHAT READY. SHARE THE PASSKEY WITH ${name.toUpperCase()} PRIVATELY.`);
  });

  // Close Modals
  document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      soundFX.tap();
      document.querySelectorAll('.modal-overlay-modern').forEach(m => m.classList.remove('open'));
    });
  });

  document.querySelectorAll('.modal-overlay-modern').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        soundFX.tap();
        modal.classList.remove('open');
      }
    });
  });

  // Mobile Back Button
  btnMobileBack.addEventListener('click', (event) => {
    event.stopPropagation();
    soundFX.tap();
    conversationPaneEl.classList.remove('active-mobile');
  });

  // Search Filter
  searchInputEl.addEventListener('input', () => {
    renderChatsList();
  });

  // Theme Toggle
  btnToggleTheme.addEventListener('click', () => {
    soundFX.tap();
    const isLight = document.body.getAttribute('data-theme') === 'light';
    if (isLight) {
      document.body.removeAttribute('data-theme');
      localStorage.setItem('modern_theme', 'dark');
      showToast('THEME: LUXURY OBSIDIAN DARK');
    } else {
      document.body.setAttribute('data-theme', 'light');
      localStorage.setItem('modern_theme', 'light');
      showToast('THEME: FROSTED PLATINUM LIGHT');
    }
  });

  if (localStorage.getItem('modern_theme') === 'light') {
    document.body.setAttribute('data-theme', 'light');
  }

  // Audio Toggle
  btnToggleAudio.addEventListener('click', () => {
    const enabled = soundFX.toggle();
    audioIconSvg.style.opacity = enabled ? '1' : '0.4';
    showToast(`AUDIO FEEDBACK: ${enabled ? 'ACTIVE' : 'MUTED'}`);
  });

  // Initial Boot
  renderChatsList();
  renderActiveChat();
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {
      // The app remains usable online if offline caching is unavailable.
    });
  }
});
