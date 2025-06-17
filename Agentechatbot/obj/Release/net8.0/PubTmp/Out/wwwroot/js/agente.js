"use strict";
// Al inicio de tu script en agente.js
if (typeof USER_DATA === 'undefined') {
    console.error("Error: USER_DATA no está definido");
    // Definir valores por defecto
    window.USER_DATA = {
        name: "Usuario",
        sessionId: "default-session"
    };
}
document.addEventListener("DOMContentLoaded", () => {
    // ── Referencias UI ─────────────────────────────────────────────
    const chatContainer = document.getElementById("chatContainer");
    const statusEl = document.getElementById("connectionStatus");
    const chatMessages = document.getElementById("chatMessages");
    const msgInput = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendBtn");
    const agentDisplayName = document.getElementById("agentDisplayName");
    const typingIndicator = document.getElementById("typingIndicator");
    const clearChatBtn = document.getElementById("clearChat");
    const settingsBtn = document.getElementById("settingsBtn");
    const closeModalBtn = document.getElementById("closeModal");
    const saveSettingsBtn = document.getElementById("saveSettingsBtn");
    const settingsModal = document.getElementById("settingsModal");

    // Usar datos preexistentes en la página
    let connection;
    let agentName = USER_DATA ? USER_DATA.name : "Usuario";
    let sessionId = USER_DATA ? USER_DATA.sessionId : "";

    // Función para obtener la hora actual formateada
    function getCurrentTime() {
        const now = new Date();
        return now.getHours().toString().padStart(2, '0') + ':' +
            now.getMinutes().toString().padStart(2, '0');
    }

    // Iniciar conexión directamente
    initializeConnection();

    // ── Configura SignalR ──────────────────────────────────────────
    function initializeConnection() {
        connection = new signalR.HubConnectionBuilder()
            .withUrl("https://localhost:7053/chatHub")
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.Information)
            .build();

        // Estados de conexión
        connection.onreconnecting(() => {
            statusEl.textContent = "🟡 Reintentando...";
            statusEl.className = "status reconnecting badge bg-warning";
        });

        connection.onreconnected(() => {
            statusEl.textContent = "🟢 Conectado";
            statusEl.className = "status online badge bg-success";
        });

        connection.onclose(() => {
            statusEl.textContent = "🔴 Desconectado";
            statusEl.className = "status offline badge bg-danger";
        });

        // Manejo de mensajes entrantes - Con debugging mejorado
        connection.on("ReceiveMessage", payload => {
            console.log("Mensaje recibido:", payload); // Para depuración

            // Ocultar indicador de escritura
            if (typingIndicator) {
                typingIndicator.hidden = true;
            }

            if (!payload || !payload.type) {
                console.error("Payload inválido recibido:", payload);
                return;
            }

            switch (payload.type) {
                case "system_message":
                    addSystemMessage(payload.message);
                    break;

                case "user_message":
                    // Asegurarse de que sea un mensaje de usuario de otro usuario, no del agente
                    console.log("Mensaje de usuario recibido:", payload);
                    addUserMessage(payload.message);
                    break;

                case "bot_message":
                    addBotMessage(payload.message);
                    break;

                case "agent_message":
                    // Solo muestra mensajes de otros agentes
                    if (payload.agent && payload.agent.name !== agentName) {
                        addAgentMessage(payload.agent.name, payload.message);
                    }
                    break;

                case "typing":
                    // Mostrar indicador de escritura
                    if (typingIndicator) {
                        typingIndicator.hidden = false;
                    }
                    break;

                default:
                    console.warn("Tipo de mensaje desconocido:", payload.type);
            }
        });

        // Conectar y registrar
        connection.start()
            .then(() => {
                statusEl.textContent = "🟢 Conectado";
                statusEl.className = "status online badge bg-success";
                agentDisplayName.textContent = agentName;
                return connection.invoke("RegisterAgent", sessionId);
            })
            .then(() => {

                // Actualizar el mensaje de bienvenida con la hora actual
                const welcomeMessageTime = document.querySelector('.message.whatsapp-agent .message-time');
                if (welcomeMessageTime) {
                    welcomeMessageTime.textContent = getCurrentTime();
                }

                // Enviar un mensaje de bienvenida personalizado a través de SignalR
                const welcomeMessage = `¡Hola! Soy ${agentName}, tu asistente. ¿En qué puedo ayudarte hoy?`;
                connection.invoke("AgentReply", sessionId, welcomeMessage, agentName)
                    .catch(err => console.error("Error al enviar mensaje de bienvenida:", err));
            })
            .catch(err => {
                console.error(err);
                addSystemMessage("Error al conectar con el servidor");
            });

        // Enviar respuestas
        sendBtn.addEventListener("click", sendAgentReply);
        msgInput.addEventListener("keypress", e => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendAgentReply();
            }
        });

        // Manejar botón de limpiar chat
        if (clearChatBtn) {
            clearChatBtn.addEventListener("click", () => {
                if (confirm("¿Estás seguro de que deseas limpiar el historial del chat?")) {
                    chatMessages.innerHTML = "";
                    addSystemMessage("El historial del chat ha sido limpiado");
                }
            });
        }

        // Manejar modal de ajustes
        if (settingsBtn && settingsModal) {
            settingsBtn.addEventListener("click", () => {
                // Usar Bootstrap para mostrar modal
                const modal = new bootstrap.Modal(settingsModal);
                modal.show();
            });
        }

        if (closeModalBtn) {
            closeModalBtn.addEventListener("click", () => {
                const modal = bootstrap.Modal.getInstance(settingsModal);
                if (modal) {
                    modal.hide();
                }
            });
        }

        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener("click", () => {
                const nameInput = document.getElementById("nameInput");
                if (nameInput && nameInput.value.trim() !== "") {
                    agentName = nameInput.value.trim();
                    agentDisplayName.textContent = agentName;
                    addSystemMessage(`Nombre cambiado a "${agentName}"`);
                }

                const modal = bootstrap.Modal.getInstance(settingsModal);
                if (modal) {
                    modal.hide();
                }
            });
        }
    }

    // ── Envía respuesta del agente ─────────────────────────────────
    function sendAgentReply() {
        const text = msgInput.value.trim();
        if (!text) return;
        addAgentMessage(agentName, text);
        msgInput.value = "";
        connection.invoke("AgentReply", sessionId, text, agentName)
            .catch(err => {
                console.error(err);
                addSystemMessage("Error al enviar respuesta");
            });
    }

    // ── Funciones de mensajes ─────────────────────────────────────
    function addSystemMessage(message) {
        const div = document.createElement("div");
        div.className = "message system-message d-flex mb-3";
        div.innerHTML = `
        <div class="message-content">
            <div class="message-bubble bg-light p-3 rounded shadow-sm">
                ${message}
            </div>
            <div class="message-time small text-muted mt-1">${getCurrentTime()}</div>
        </div>
    `;
        chatMessages.appendChild(div);
        animateNewMessage(div);
        playMessageSound();
    }

    function addUserMessage(message) {
        const div = document.createElement("div");
        div.className = "message user-message d-flex mb-3 justify-content-end";
        div.innerHTML = `
        <div class="message-content whatsapp-user">
            <p>${message}</p>
            <span class="message-time">${getCurrentTime()}</span>
        </div>
        <div class="message-avatar rounded-circle bg-light text-primary ms-2 d-flex align-items-center justify-content-center">
            <i class="fa-solid fa-user"></i>
        </div>
    `;
        chatMessages.appendChild(div);
        animateNewMessage(div);
        playMessageSound();
    }

    function addBotMessage(message) {
        const div = document.createElement("div");
        div.className = "message bot-message d-flex mb-3";
        div.innerHTML = `
        <div class="message-avatar rounded-circle bg-primary text-white me-2 d-flex align-items-center justify-content-center">
            <i class="fa-solid fa-robot"></i>
        </div>
        <div class="message-content whatsapp-agent">
            <p>${message}</p>
            <span class="message-time">${getCurrentTime()}</span>
        </div>
    `;
        chatMessages.appendChild(div);
        animateNewMessage(div);
        playMessageSound();
    }

    function addAgentMessage(name, text) {
        const div = document.createElement("div");
        div.className = "message agent-message d-flex mb-3";
        div.innerHTML = `
        <div class="message-avatar rounded-circle bg-info text-white me-2 d-flex align-items-center justify-content-center">
            <i class="fa-solid fa-user-headset"></i>
        </div>
        <div class="message-content">
            <div class="message-header small fw-bold text-muted mb-1">${name}</div>
            <div class="message-content whatsapp-agent">
                <p>${text}</p>
                <span class="message-time">${getCurrentTime()}</span>
            </div>
        </div>
    `;
        chatMessages.appendChild(div);
        animateNewMessage(div);
        playMessageSound();
    }

    // Función para animar nuevos mensajes
    function animateNewMessage(element) {
        // Asegura que el elemento está invisible inicialmente
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';

        // Permite que el DOM se actualice antes de la animación
        setTimeout(() => {
            element.style.transition = 'all 0.3s ease';
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 10);
    }

    // Función para reproducir sonido cuando llega un mensaje
    let messageSound;
    let soundEnabled = localStorage.getItem('sound-enabled') === 'true';

    function initializeSound() {
        messageSound = new Audio('/sounds/message.mp3');

        // Conectar el toggle de sonido en el modal
        const soundToggle = document.getElementById('soundToggle');
        if (soundToggle) {
            soundToggle.checked = soundEnabled;
            soundToggle.addEventListener('change', function () {
                soundEnabled = this.checked;
                localStorage.setItem('sound-enabled', soundEnabled);
            });
        }
    }

    function playMessageSound() {
        if (soundEnabled && messageSound) {
            messageSound.currentTime = 0;
            messageSound.play().catch(e => console.log("Error reproduciendo sonido:", e));
        }
    }

    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener("click", () => {
            const nameInput = document.getElementById("nameInput");
            if (nameInput && nameInput.value.trim() !== "") {
                agentName = nameInput.value.trim();
                agentDisplayName.textContent = agentName;
                addSystemMessage(`Nombre cambiado a "${agentName}"`);
            }

            // Actualizar la configuración de sonido
            const soundToggle = document.getElementById('soundToggle');
            if (soundToggle) {
                soundEnabled = soundToggle.checked;
                localStorage.setItem('sound-enabled', soundEnabled);
            }

            const modal = bootstrap.Modal.getInstance(settingsModal);
            if (modal) {
                modal.hide();
            }
        });
    }

    // Inicializar sonido al cargar
    initializeSound();
});


// Añade esto en el script existente de index.cshtml, después del código de temas
document.addEventListener('DOMContentLoaded', function () {
    // Agregar efectos a los botones
    const buttons = document.querySelectorAll('button:not(.navbar-toggler)');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', function () {
            this.style.transform = 'scale(1.05)';
        });
        button.addEventListener('mouseleave', function () {
            this.style.transform = 'scale(1)';
        });
    });

    // Animación de entrada para los mensajes iniciales
    const initialMessages = document.querySelectorAll('.message');
    initialMessages.forEach((msg, index) => {
        msg.style.opacity = '0';
        msg.style.transform = 'translateY(20px)';

        setTimeout(() => {
            msg.style.transition = 'all 0.3s ease';
            msg.style.opacity = '1';
            msg.style.transform = 'translateY(0)';
        }, 100 * index);
    });

    // Mejora visual para el indicador de escritura
    const typingDots = document.createElement('div');
    typingDots.className = 'typing-dots';
    typingDots.innerHTML = `
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
    `;

    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.innerHTML = '';
        typingIndicator.appendChild(typingDots);
    }
});

