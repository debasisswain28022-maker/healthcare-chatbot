/* =========================
   HEALTHCARE CHATBOT SCRIPT
   ========================= */

/* 🔊 Sound Effects */
const sendSound = new Audio("/static/sounds/send.wav");
const receiveSound = new Audio("/static/sounds/receive.wav");

sendSound.volume = 0.6;
receiveSound.volume = 0.6;

/* 🔓 Audio unlock flag */
let audioUnlocked = false;

/* 🌙 Initialize dark mode from localStorage */
function initializeDarkMode() {
    const isDarkMode = localStorage.getItem("darkMode") === "true";
    if (isDarkMode) {
        document.body.classList.add("dark");
    }
}

/* ⌨️ Enter key support */
document.addEventListener("DOMContentLoaded", () => {
    initializeDarkMode();
    
    const input = document.getElementById("user-input");

    if (!input) return;

    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            sendMessage();
        }
    });
});

/* 📤 Send Message */
function sendMessage() {
    sendChatRequest("/chat");
}

function sendDiagnosis() {
    sendChatRequest("/diagnose");
}

function renderDiagnoses(diagnoses) {
    if (!diagnoses || diagnoses.length === 0) {
        return "<p>No matching conditions found. Please describe your symptoms in more detail.</p>";
    }

    let html = "<p>Based on your symptoms, here are the most likely conditions:</p><div class='diagnoses-list'>";
    
    diagnoses.forEach(d => {
        const percentage = Math.round(d.match_ratio * 100);
        html += `
            <div class="diagnosis-card">
                <h4>${d.disease}</h4>
                <div class="match-info">
                    <div class="match-bar">
                        <div class="match-fill" style="width: ${percentage}%"></div>
                    </div>
                    <span class="match-text">${d.match_count}/${d.total_symptoms} symptoms match (${percentage}%)</span>
                </div>
            </div>
        `;
    });
    
    html += "</div><p class='diagnosis-note'>⚠️ This is not a medical diagnosis. Please consult a healthcare professional for proper evaluation.</p>";
    return html;
}

function sendChatRequest(url) {
    const input = document.getElementById("user-input");
    const chatBox = document.getElementById("chat-box");

    if (!input || !chatBox) return;

    const message = input.value.trim();
    if (message === "") return;

    /* 🔓 Unlock audio on first real user action */
    if (!audioUnlocked) {
        sendSound.play().then(() => {
            sendSound.pause();
            sendSound.currentTime = 0;
            audioUnlocked = true;
        }).catch(() => {});
    }

    /* 🔔 Play send sound */
    sendSound.currentTime = 0;
    sendSound.play().catch(() => {});

    /* 👤 User message */
    const userDiv = document.createElement("div");
    userDiv.className = "user-message";
    userDiv.innerText = message;
    chatBox.appendChild(userDiv);

    input.value = "";

    /* ⌛ Typing indicator */
    const typingDiv = document.createElement("div");
    typingDiv.className = "typing";
    typingDiv.innerHTML = `Bot is typing <span></span><span></span><span></span>`;
    chatBox.appendChild(typingDiv);

    chatBox.scrollTop = chatBox.scrollHeight;

    /* 🌐 Fetch bot response */
    fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
    })
    .then(res => {
        if (!res.ok) {
            return res.json().then(errData => {
                throw errData;
            });
        }
        return res.json();
    })
    .then(data => {

        /* Remove typing */
        chatBox.removeChild(typingDiv);

        /* 🔊 Receive sound */
        receiveSound.currentTime = 0;
        receiveSound.play().catch(() => {});

        /* 🤖 Bot message */
        const botDiv = document.createElement("div");
        botDiv.className = "bot-message";

        const botText = document.createElement("div");
        botText.className = "bot-text";

        // Prefer explicit reply, otherwise fallback to diagnoses list if present.
        if (data.reply) {
            botText.innerText = data.reply;
        } else if (data.diagnoses) {
            botText.innerHTML = renderDiagnoses(data.diagnoses);
        } else {
            botText.innerText = "Sorry, I didn't understand.";
        }

        /* 🔊 Voice button */
        const voiceBtn = document.createElement("button");
        voiceBtn.className = "voice-btn";
        voiceBtn.innerText = "🔊 Listen";
        voiceBtn.onclick = () => speakDiagnosis(data);

        botDiv.appendChild(botText);
        botDiv.appendChild(voiceBtn);
        chatBox.appendChild(botDiv);

        chatBox.scrollTop = chatBox.scrollHeight;
    })
    .catch(err => {
        console.error("Chat error:", err);
        chatBox.removeChild(typingDiv);

        const botDiv = document.createElement("div");
        botDiv.className = "bot-message";
        const botText = document.createElement("div");
        botText.className = "bot-text";
        botText.innerText = err.message || err.reply || "Unable to get response. Please try again.";
        botDiv.appendChild(botText);
        chatBox.appendChild(botDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

/* 🔊 Text-to-Speech */
function speakText(text) {
    if (!text) return;

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = "en-IN";
    speech.rate = 0.9;
    speech.pitch = 1;

    window.speechSynthesis.speak(speech);
}

function speakDiagnosis(data) {
    let text = "";
    if (data.reply) {
        text = data.reply;
    } else if (data.diagnoses) {
        text = "Based on your symptoms, the most likely conditions are: ";
        data.diagnoses.forEach((d, index) => {
            const percentage = Math.round(d.match_ratio * 100);
            text += `${d.disease}, with ${d.match_count} out of ${d.total_symptoms} symptoms matching, that's ${percentage} percent. `;
        });
        text += "Remember, this is not a medical diagnosis. Please consult a healthcare professional.";
    }
    speakText(text);
}

/* 🌙 Dark mode toggle */
function toggleDarkMode() {
    document.body.classList.toggle("dark");
    const isDarkMode = document.body.classList.contains("dark");
    localStorage.setItem("darkMode", isDarkMode);
}
