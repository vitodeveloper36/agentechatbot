// Funciones para notificaciones
function showNotification(message, type = 'primary') {
    const toast = document.getElementById('notificationToast');
    const toastMessage = document.getElementById('toastMessage');
    
    if (toast && toastMessage) {
        // Actualizar mensaje y clase
        toastMessage.textContent = message;
        
        // Eliminar clases de color anteriores
        toast.className = toast.className.replace(/bg-\w+/, '');
        
        // Agregar nueva clase de color
        toast.classList.add(`bg-${type}`);
        
        // Mostrar toast
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
    }
}

// Exponer funciones globalmente
window.ChatNotifications = {
    show: showNotification
};