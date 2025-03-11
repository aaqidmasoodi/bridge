// DOM Elements
const messageInputField = document.getElementById('message-input-field');
const messageInputFieldBtn = document.getElementById('message-input-button');
const chatThread = document.getElementsByClassName('chat-thread')[0];

// Groq API Key
const API_KEY = "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"; // Replace with your Groq API key

// WebSocket Connection
// WebSocket Connection
const socket = new WebSocket('wss://bridge-server-socket.onrender.com'); // Updated WebSocket URL

// Function to translate text using Groq API and Llama 3
async function translateText(inputText) {
    const prompt = `Translate the following text to Arabic if it is in English, or to English if it is in Arabic. Do not add any extra words. Only provide the translated text. Do not say "I'm happy to help! The translation is:". Text: ${inputText}`;

    const payload = {
        messages: [
            { role: "system", content: `You are a helpful assistant that translates text.` },
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

// Handle incoming messages from the WebSocket server
socket.onmessage = (event) => {
    const message = JSON.parse(event.data); // Parse the message (should be an object with original and translated text)

    // Display the received message in the chat thread
    chatThread.innerHTML += `
    <div class="bubble gray-bubble">
        <p class="gray-original-message">${message.original}</p>
        <p class="gray-translated-message">${message.translated}</p>
    </div>`;

    // Scroll to the bottom of the chat thread
    chatThread.scrollTop = chatThread.scrollHeight;
};

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