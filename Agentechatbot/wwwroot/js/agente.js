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
    const refreshFilesBtn = document.getElementById('refreshFilesBtn');

    // Usar datos preexistentes en la página
    let connection;
    let agentName = USER_DATA ? USER_DATA.name : "Usuario";
    let sessionId = USER_DATA ? USER_DATA.sessionId : "";

    // Función para reproducir sonido cuando llega un mensaje
    let messageSound;
    let soundEnabled = localStorage.getItem('sound-enabled') === 'true';

    // Función para obtener la hora actual formateada
    function getCurrentTime() {
        const now = new Date();
        return now.getHours().toString().padStart(2, '0') + ':' +
            now.getMinutes().toString().padStart(2, '0');
    }

    // Inicializar conexión
    initializeConnection();

    // Si existe el elemento de la lista de archivos, cargarlos después de inicializar
    if (document.getElementById('filesList')) {
        // Esperar un poco para que la conexión SignalR esté lista
        setTimeout(loadSessionFiles, 1000);
    }

    // Configurar botón de actualización de archivos
    if (refreshFilesBtn) {
        refreshFilesBtn.addEventListener('click', loadSessionFiles);
    }

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

        // Manejo de mensajes entrantes
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

                case "file_upload":
                    // Manejar archivos subidos por el usuario
                    addFileMessage(payload);
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

                // Actualizar la configuración de sonido
                const soundToggle = document.getElementById('soundToggle');
                if (soundToggle) {
                    soundEnabled = soundToggle.checked;
                    localStorage.setItem('sound-enabled', soundEnabled);
                }

                // Gestionar opción de archivos
                const filesToggle = document.getElementById('filesToggle');
                if (filesToggle && filesToggle.checked) {
                    connection.invoke("ActivateAgentMode", sessionId)
                        .catch(err => {
                            console.error("Error al activar modo agente:", err);
                            addSystemMessage("Error al activar la recepción de archivos");
                        });
                    addSystemMessage("Recepción de archivos activada");
                } else if (filesToggle) {
                    connection.invoke("DeactivateAgentMode", sessionId)
                        .catch(err => {
                            console.error("Error al desactivar modo agente:", err);
                            addSystemMessage("Error al desactivar la recepción de archivos");
                        });
                    addSystemMessage("Recepción de archivos desactivada");
                }

                const modal = bootstrap.Modal.getInstance(settingsModal);
                if (modal) {
                    modal.hide();
                }
            });
        }
    }

    // ── Función para cargar archivos (FUERA de initializeConnection) ──────────
    function loadSessionFiles() {
        console.log("Cargando archivos de la sesión:", sessionId);
        const filesList = document.getElementById('filesList');

        if (!filesList) {
            console.error("Elemento filesList no encontrado");
            return;
        }

        // Deshabilitar botón de recarga durante la petición
        if (refreshFilesBtn) {
            refreshFilesBtn.disabled = true;
            refreshFilesBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        }

        // Mostrar indicador de carga
        filesList.innerHTML = `
            <div class="text-center py-4 text-muted">
                <i class="fa-solid fa-spinner fa-spin mb-2"></i>
                <p>Cargando archivos...</p>
            </div>
        `;

        // Realizar petición al servidor
        fetch(`/Chat/GetSessionFiles?sessionId=${sessionId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Error al cargar archivos');
                }
                return response.json();
            })
            .then(files => {
                if (files.length === 0) {
                    filesList.innerHTML = `
                        <div class="text-center py-4 text-muted">
                            <i class="fa-solid fa-folder-open fa-2x mb-2"></i>
                            <p>No hay archivos en esta sesión</p>
                        </div>
                    `;
                    return;
                }

                // Renderizar la lista de archivos
                filesList.innerHTML = '';
                files.forEach(file => {
                    // Determinar el icono según extensión
                    let fileIcon = 'fa-file';
                    const ext = file.extension.toLowerCase();
                    if (ext === '.pdf') fileIcon = 'fa-file-pdf';
                    else if (['.doc', '.docx'].includes(ext)) fileIcon = 'fa-file-word';
                    else if (['.xls', '.xlsx'].includes(ext)) fileIcon = 'fa-file-excel';
                    else if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) fileIcon = 'fa-file-image';

                    const fileItem = document.createElement('div');
                    fileItem.className = 'file-item list-group-item d-flex align-items-start border-bottom';
                    fileItem.innerHTML = `
                        <div class="file-icon text-primary">
                            <i class="fa-solid ${fileIcon}"></i>
                        </div>
                        <div class="flex-grow-1">
                            <div class="file-name">${file.name}</div>
                            <div class="file-meta">
                                <span>${file.size}</span> • 
                                <span>${file.dateUploaded}</span>
                            </div>
                        </div>
                        <div class="file-actions">
                            <button class="btn btn-sm btn-outline-primary download-file-btn" 
                                    data-file-name="${file.fileName}"
                                    title="Descargar archivo">
                                <i class="fa-solid fa-download"></i>
                            </button>
                        </div>
                    `;

                    // Añadir manejador de eventos para descarga
                    const downloadBtn = fileItem.querySelector('.download-file-btn');
                    if (downloadBtn) {
                        downloadBtn.addEventListener('click', function () {
                            const fileName = this.getAttribute('data-file-name');
                            downloadFile(sessionId, fileName);
                        });
                    }

                    filesList.appendChild(fileItem);
                });
            })
            .catch(error => {
                console.error('Error:', error);
                filesList.innerHTML = `
                    <div class="text-center py-4 text-danger">
                        <i class="fa-solid fa-triangle-exclamation fa-2x mb-2"></i>
                        <p>Error al cargar archivos</p>
                    </div>
                `;
            })
            .finally(() => {
                // Habilitar botón de recarga
                if (refreshFilesBtn) {
                    refreshFilesBtn.disabled = false;
                    refreshFilesBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i>';
                }
            });
    }

    // ── Función para descargar archivos ─────────────────────────────
    function downloadFile(sessionId, fileName) {
        // Mostrar indicador de descarga
        addSystemMessage(`Descargando archivo: ${fileName}...`);

        // Crear un formulario para enviar la solicitud POST
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/Chat/DownloadFile';
        form.style.display = 'none';

        // Añadir el session ID
        const sessionIdInput = document.createElement('input');
        sessionIdInput.type = 'hidden';
        sessionIdInput.name = 'sessionId';
        sessionIdInput.value = sessionId;
        form.appendChild(sessionIdInput);

        // Añadir el nombre del archivo
        const fileNameInput = document.createElement('input');
        fileNameInput.type = 'hidden';
        fileNameInput.name = 'fileName';
        fileNameInput.value = fileName;
        form.appendChild(fileNameInput);

        // Añadir token antifalsificación
        const tokenInput = document.createElement('input');
        tokenInput.type = 'hidden';
        tokenInput.name = '__RequestVerificationToken';
        const token = document.querySelector('input[name="__RequestVerificationToken"]')?.value;
        if (token) {
            tokenInput.value = token;
            form.appendChild(tokenInput);
        }

        // Añadir el formulario al documento y enviarlo
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
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

    // Función para mostrar mensajes de archivos recibidos
    function addFileMessage(payload) {
        const { fileName, fileSize, fileType, message } = payload;

        // Determinar el icono según el tipo de archivo
        let fileIcon = 'fa-file';
        if (fileType === '.pdf') fileIcon = 'fa-file-pdf';
        else if (['.doc', '.docx'].includes(fileType)) fileIcon = 'fa-file-word';
        else if (['.xls', '.xlsx'].includes(fileType)) fileIcon = 'fa-file-excel';

        const div = document.createElement("div");
        div.className = "message file-message d-flex mb-3";
        div.innerHTML = `
            <div class="message-avatar rounded-circle bg-warning text-white me-2 d-flex align-items-center justify-content-center">
                <i class="fa-solid fa-paperclip"></i>
            </div>
            <div class="message-content">
                <div class="message-header small fw-bold text-muted mb-1">Archivo recibido</div>
                <div class="message-bubble file-bubble p-3 rounded shadow-sm">
                    <div class="file-preview d-flex align-items-center">
                        <div class="file-icon me-3">
                            <i class="fa-solid ${fileIcon} fa-2x text-primary"></i>
                        </div>
                        <div class="file-info">
                            <div class="file-name fw-bold">${fileName}</div>
                            <div class="file-size text-muted small">${fileSize}</div>
                        </div>
                    </div>
                    <div class="mt-2">
                        <small class="text-muted">${message}</small>
                    </div>
                </div>
                <div class="message-time small text-muted mt-1">${getCurrentTime()}</div>
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

    // Inicializar sonido al cargar
    initializeSound();

    // Aplicar efectos visuales a los botones
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
    if (typingIndicator) {
        const typingDots = document.createElement('div');
        typingDots.className = 'typing-dots';
        typingDots.innerHTML = `
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
        `;
        typingIndicator.innerHTML = '';
        typingIndicator.appendChild(typingDots);
    }
});