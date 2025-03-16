// DOM Elements
const messageInputField = document.getElementById('message-input-field');
const messageInputFieldBtn = document.getElementById('message-input-button');
const chatThread = document.getElementsByClassName('chat-thread')[0];
const loadingIndicator = document.getElementById('loading-indicator');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const startVideoButton = document.getElementById('start-video-button');

// Groq API Key
const API_KEY = "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";

// WebSocket Connection
let socket;
const SOCKET_URL = 'wss://bridge-server-socket.onrender.com';
let reconnectInterval = 3000; // 3 seconds

// WebRTC Variables
let localStream;
let remoteStream;
let peerConnection;
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' } // Google's public STUN server
    ]
};

// Initialize WebSocket and WebRTC
function connectWebSocket() {
    socket = new WebSocket(SOCKET_URL);
    loadingIndicator.style.display = 'flex';

    socket.onopen = () => {
        console.log('WebSocket connection established.');
        loadingIndicator.style.display = 'none';
    };

    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        loadingIndicator.innerHTML = '<p>...فشل الاتصال. يُرجى المحاولة لاحقًا</p>';
    };

    socket.onclose = () => {
        console.log('WebSocket connection closed. Reconnecting...');
        loadingIndicator.style.display = 'flex';
        loadingIndicator.innerHTML = '<p>...انقطع الاتصال. جاري إعادة الاتصال</p>';
        setTimeout(connectWebSocket, reconnectInterval);
    };

    socket.onmessage = async (event) => {
        const message = JSON.parse(event.data);

        if (message.type === 'offer') {
            await handleOffer(message.offer);
        } else if (message.type === 'answer') {
            await handleAnswer(message.answer);
        } else if (message.type === 'candidate') {
            await handleCandidate(message.candidate);
        } else if (message.type === 'connection') {
            updateConnectionStatus(message.count);
        } else {
            // Handle regular chat messages
            chatThread.innerHTML += `
            <div class="bubble gray-bubble">
                <p class="gray-original-message">${message.original}</p>
                <p class="gray-translated-message">${message.translated}</p>
            </div>`;
            chatThread.scrollTop = chatThread.scrollHeight;
        }
    };
}

// Start local video stream after user interaction
startVideoButton.addEventListener('click', async () => {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;

        if (clientCount === 2) {
            createPeerConnection();
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            socket.send(JSON.stringify({ type: 'offer', offer: offer }));
        }
    } catch (error) {
        console.error('Error accessing media devices:', error);
        alert('Failed to access camera and microphone. Please ensure permissions are granted.');
    }
});

// Create RTCPeerConnection
function createPeerConnection() {
    peerConnection = new RTCPeerConnection(configuration);

    // Add local stream tracks
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    // Handle remote stream
    peerConnection.ontrack = (event) => {
        remoteStream = event.streams[0];
        remoteVideo.srcObject = remoteStream;
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
        }
    };
}

// Handle incoming offer
async function handleOffer(offer) {
    createPeerConnection();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.send(JSON.stringify({ type: 'answer', answer: answer }));
}

// Handle incoming answer
async function handleAnswer(answer) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

// Handle incoming ICE candidate
async function handleCandidate(candidate) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
}

// Function to update connection status
function updateConnectionStatus(count) {
    let connectionStatus = document.getElementById('connection-status');

    if (count === 2) {
        if (!connectionStatus) {
            connectionStatus = document.createElement('div');
            connectionStatus.id = 'connection-status';
            document.body.insertBefore(connectionStatus, document.body.firstChild);
        }
        connectionStatus.textContent = '...الشخص الآخر متصل';
        connectionStatus.style.color = 'green';
    } else if (count === 1) {
        if (!connectionStatus) {
            connectionStatus = document.createElement('div');
            connectionStatus.id = 'connection-status';
            document.body.insertBefore(connectionStatus, document.body.firstChild);
        }
        connectionStatus.textContent = '...في انتظار شخص آخر للاتصال';
        connectionStatus.style.color = 'red';
    } else if (count === 0) {
        if (connectionStatus) {
            connectionStatus.remove(); // Remove the status element if no one is connected
        }
    }
}

// Function to translate text using Groq API and Llama 3
async function translateText(inputText) {
    const prompt = `Translate the following text to Arabic if it is in English, or to English if it is in Arabic. Do not add any extra words. Only provide the translated text. Do not say "I'm happy to help! The translation is:". Text: ${inputText}`;

    const payload = {
        messages: [
            { role: "system", content: `You are a helpful assistant that translates text between arabic and english.` },
            { role: "user", content: prompt }
        ],
        model: "llama3-70b-8192", // Use the Llama 3 model
        temperature: 0.7,
        max_tokens: 1024,
        top_p: 1,
        stream: false
    };

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("Failed to fetch translation from Llama 3.");

        const data = await response.json();
        const translatedText = data.choices[0]?.message?.content || "Translation failed.";

        // Clean up the translated text (remove quotes if any)
        return translatedText.replace(/^"|"$/g, '').trim();
    } catch (error) {
        console.error("Error during translation:", error);
        return null;
    }
}

// Event listener for the send button
messageInputFieldBtn.addEventListener('click', async () => {
    if (messageInputField.value) {
        const originalMessage = messageInputField.value;

        // Translate the message to Arabic
        const translatedMessage = await translateText(originalMessage);

        if (translatedMessage) {
            // Create a message object to send via WebSocket
            const message = {
                original: originalMessage,
                translated: translatedMessage
            };

            // Send the message to the WebSocket server
            socket.send(JSON.stringify(message));

            // Display the original and translated messages in the chat thread
            chatThread.innerHTML += `
            <div class="bubble blue-bubble">
                <p class="blue-original-message">${originalMessage}</p>
                <p class="blue-translated-message">${translatedMessage}</p>
            </div>`;

            // Clear the input field
            messageInputField.value = '';

            // Scroll to the bottom of the chat thread
            chatThread.scrollTop = chatThread.scrollHeight;
        } else {
            alert("Translation failed. Please try again.");
        }
    }
});

// Optional: Allow sending messages by pressing "Enter" key
messageInputField.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        messageInputFieldBtn.click(); // Trigger the send button click
    }
});

// PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then((registration) => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch((err) => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

// Initial connection
connectWebSocket();