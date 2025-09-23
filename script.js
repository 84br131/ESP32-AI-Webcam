// Variables globales
let model = null;
let webcam = null;
let isModelLoaded = false;
let serialPort = null;
let writer = null;
let isConnected = false;
let modelUrl = '';
let isCameraOn = true;
let lastDetectedClass = '';
let stream = null;

// Configuración
const CONFIDENCE_THRESHOLD = 0.6; // 60%
const BAUD_RATE = 115200;

// Referencias DOM
const video = document.getElementById('webcam');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const modelUrlInput = document.getElementById('modelUrl');
const loadModelBtn = document.getElementById('loadModelBtn');
const cameraToggle = document.getElementById('cameraToggle');
const connectBtn = document.getElementById('connectBtn');
const connectionStatus = document.getElementById('connectionStatus');
const className = document.getElementById('className');
const confidence = document.getElementById('confidence');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const chatMessages = document.getElementById('chatMessages');
const clearChatBtn = document.getElementById('clearChatBtn');

// Inicializar la aplicación
async function init() {
    try {
        console.log('Inicializando aplicación...');
        
        // Inicializar cámara
        await setupCamera();
        
        // Configurar eventos
        setupEventListeners();
        
        // Ocultar loading inicial
        loading.style.display = 'none';
        
        addChatMessage('Sistema iniciado correctamente. Configure el modelo para comenzar.', 'system');
        console.log('Aplicación inicializada correctamente');
        
    } catch (error) {
        console.error('Error al inicializar:', error);
        showError('Error al inicializar la aplicación: ' + error.message);
    }
}

// Cargar modelo de Teachable Machine
async function loadModel(url) {
    try {
        if (!url) {
            throw new Error('URL del modelo requerida');
        }
        
        // Normalizar URL
        let normalizedUrl = url.trim();
        if (!normalizedUrl.endsWith('/')) {
            normalizedUrl += '/';
        }
        
        console.log('Cargando modelo desde:', normalizedUrl);
        loadingText.textContent = 'Cargando modelo de IA...';
        loading.style.display = 'flex';
        
        // Intentar cargar el modelo
        model = await tmImage.load(normalizedUrl + 'model.json', normalizedUrl + 'metadata.json');
        
        isModelLoaded = true;
        modelUrl = normalizedUrl;
        loading.style.display = 'none';
        
        console.log('Modelo cargado correctamente');
        console.log('Clases del modelo:', model.getClassLabels());
        
        addChatMessage(`Modelo cargado: ${model.getClassLabels().join(', ')}`, 'system');
        
        // Iniciar predicciones
        predict();
        
    } catch (error) {
        console.error('Error al cargar modelo:', error);
        loading.style.display = 'none';
        showError('No se pudo cargar el modelo. Verifica que la URL sea correcta y contenga model.json y metadata.json');
        addChatMessage('Error al cargar modelo: ' + error.message, 'error');
    }
}

// Configurar cámara web
async function setupCamera() {
    try {
        console.log('Configurando cámara...');
        
        stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                width: 640, 
                height: 480,
                facingMode: 'environment' // Cámara trasera en móviles
            }
        });
        
        video.srcObject = stream;
        
        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                // Ajustar canvas al tamaño del video
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                console.log('Cámara configurada correctamente');
                resolve();
            };
        });
        
    } catch (error) {
        console.error('Error al acceder a la cámara:', error);
        throw new Error('No se pudo acceder a la cámara. Verifica los permisos.');
    }
}

// Configurar event listeners
function setupEventListeners() {
    loadModelBtn.addEventListener('click', () => {
        const url = modelUrlInput.value.trim();
        if (url) {
            loadModel(url);
        } else {
            showError('Por favor ingresa una URL válida del modelo');
        }
    });
    
    cameraToggle.addEventListener('click', toggleCamera);
    
    connectBtn.addEventListener('click', toggleSerialConnection);
    clearChatBtn.addEventListener('click', clearChat);
    
    // Verificar soporte para Web Serial API
    if (!('serial' in navigator)) {
        connectBtn.disabled = true;
        connectBtn.textContent = '❌ Web Serial no disponible';
        connectionStatus.textContent = 'Web Serial API no disponible';
        connectionStatus.style.color = '#ff4444';
        addChatMessage('Web Serial API no disponible en este navegador', 'error');
    }
}

// Alternar cámara encendida/apagada
async function toggleCamera() {
    if (isCameraOn) {
        // Apagar cámara
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        video.srcObject = null;
        isCameraOn = false;
        cameraToggle.textContent = '📹 Encender Cámara';
        cameraToggle.style.backgroundColor = '#4caf50';
        
        // Limpiar display
        className.textContent = 'Cámara apagada';
        confidence.textContent = 'Confianza: 0%';
        
        addChatMessage('Cámara apagada', 'system');
        console.log('Cámara apagada');
        
    } else {
        // Encender cámara
        try {
            await setupCamera();
            isCameraOn = true;
            cameraToggle.textContent = '📹 Apagar Cámara';
            cameraToggle.style.backgroundColor = '#ff4444';
            
            // Reiniciar variables de detección
            lastDetectedClass = '';
            className.textContent = 'Inicializando...';
            confidence.textContent = 'Confianza: 0%';
            
            addChatMessage('Cámara encendida', 'system');
            console.log('Cámara encendida');
            
        } catch (error) {
            console.error('Error al encender cámara:', error);
            showError('Error al encender la cámara: ' + error.message);
        }
    }
}

// Actualizar texto del botón de conexión
function updateConnectionButton() {
    if (isConnected) {
        connectBtn.textContent = '🔌 Desconectar';
    } else {
        connectBtn.textContent = '🔌 Conectar Microcontrolador';
    }
}

// Conectar/desconectar puerto serie
async function toggleSerialConnection() {
    if (isConnected) {
        await disconnectSerial();
    } else {
        await connectSerial();
    }
}

// Conectar al ESP32 via puerto serie
async function connectSerial() {
    try {
        console.log('Solicitando puerto serie...');
        
        // Solicitar puerto serie
        serialPort = await navigator.serial.requestPort();
        
        // Abrir conexión
        await serialPort.open({ baudRate: BAUD_RATE });
        
        // Obtener writer para enviar datos
        writer = serialPort.writable.getWriter();
        
        isConnected = true;
        updateConnectionButton();
        connectBtn.style.backgroundColor = '#ff4444';
        connectionStatus.textContent = 'Conectado';
        connectionStatus.style.color = '#44ff44';
        
        console.log('Conectado al microcontrolador');
        addChatMessage('Conectado al microcontrolador', 'system');
        
    } catch (error) {
        console.error('Error al conectar:', error);
        showError('Error al conectar con microcontrolador: ' + error.message);
        addChatMessage('Error de conexión: ' + error.message, 'error');
    }
}

// Desconectar puerto serie
async function disconnectSerial() {
    try {
        if (writer) {
            writer.releaseLock();
            writer = null;
        }
        
        if (serialPort) {
            await serialPort.close();
            serialPort = null;
        }
        
        isConnected = false;
        updateConnectionButton();
        connectBtn.style.backgroundColor = '#2196f3';
        connectionStatus.textContent = 'Desconectado';
        connectionStatus.style.color = '#666';
        
        console.log('Desconectado del microcontrolador');
        addChatMessage('Desconectado del microcontrolador', 'system');
        
    } catch (error) {
        console.error('Error al desconectar:', error);
    }
}

// Enviar datos al microcontrolador
async function sendToMicrocontroller(data) {
    if (!isConnected || !writer) {
        console.warn('No hay conexión con microcontrolador');
        return;
    }
    
    try {
        const message = data + '\n';
        const encoder = new TextEncoder();
        await writer.write(encoder.encode(message));
        
        console.log('Enviado al microcontrolador:', data);
        addChatMessage(`Enviado: ${data}`, 'sent');
        
    } catch (error) {
        console.error('Error al enviar datos:', error);
        showError('Error al enviar datos al microcontrolador');
        addChatMessage('Error al enviar: ' + error.message, 'error');
    }
}

// Realizar predicciones en tiempo real
async function predict() {
    if (!isModelLoaded || !model || !isCameraOn) {
        requestAnimationFrame(predict);
        return;
    }
    
    try {
        // Dibujar frame actual en canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Hacer predicción
        const predictions = await model.predict(canvas);
        
        // Encontrar la predicción con mayor confianza
        let maxPrediction = predictions[0];
        for (let i = 1; i < predictions.length; i++) {
            if (predictions[i].probability > maxPrediction.probability) {
                maxPrediction = predictions[i];
            }
        }
        
        // Actualizar interfaz
        updateUI(maxPrediction);
        
        // Enviar al microcontrolador solo si la clase cambió y la confianza es alta
        if (maxPrediction.probability > CONFIDENCE_THRESHOLD) {
            const currentClass = maxPrediction.className;
            if (currentClass !== lastDetectedClass) {
                await sendToMicrocontroller(currentClass);
                lastDetectedClass = currentClass;
            }
        } else {
            // Si la confianza es baja, resetear la última clase detectada
            if (lastDetectedClass !== '') {
                lastDetectedClass = '';
            }
        }
        
    } catch (error) {
        console.error('Error en predicción:', error);
    }
    
    // Continuar predicciones
    requestAnimationFrame(predict);
}

// Actualizar interfaz con resultados
function updateUI(prediction) {
    const confidencePercent = Math.round(prediction.probability * 100);
    
    // Actualizar texto
    className.textContent = prediction.className;
    confidence.textContent = `Confianza: ${confidencePercent}%`;
    
    // Cambiar color según la clase
    className.className = 'class-name';
    switch (prediction.className.toLowerCase()) {
        case 'vegetal':
            className.classList.add('vegetal');
            break;
        case 'plastico':
        case 'plástico':
            className.classList.add('plastico');
            break;
        case 'nada':
            className.classList.add('nada');
            break;
        default:
            className.classList.add('default');
    }
    
    // Resaltar si la confianza es alta
    if (prediction.probability > CONFIDENCE_THRESHOLD) {
        className.style.fontWeight = '700';
        className.style.textShadow = '0 0 10px rgba(255,255,255,0.3)';
    } else {
        className.style.fontWeight = '500';
        className.style.textShadow = 'none';
    }
}

// Agregar mensaje al chat
function addChatMessage(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString('es-ES', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;
    
    messageDiv.innerHTML = `
        <span class="timestamp">[${timestamp}]</span>
        <span class="message">${message}</span>
    `;
    
    chatMessages.appendChild(messageDiv);
    
    // Scroll automático al último mensaje
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Limitar número de mensajes (opcional)
    const messages = chatMessages.querySelectorAll('.chat-message');
    if (messages.length > 100) {
        messages[0].remove();
    }
}

// Limpiar chat
function clearChat() {
    chatMessages.innerHTML = `
        <div class="chat-message system">
            <span class="timestamp">[--:--:--]</span>
            <span class="message">Chat limpiado</span>
        </div>
    `;
    addChatMessage('Chat reiniciado', 'system');
}

// Mostrar errores
function showError(message) {
    console.error(message);
    
    // Crear elemento de error si no existe
    let errorDiv = document.getElementById('errorMessage');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'errorMessage';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 1000;
            max-width: 300px;
            font-family: 'Poppins', sans-serif;
        `;
        document.body.appendChild(errorDiv);
    }
    
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // Ocultar después de 5 segundos
    setTimeout(() => {
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }, 5000);
}

// Verificar soporte de APIs necesarias
function checkBrowserSupport() {
    const issues = [];
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        issues.push('getUserMedia no soportado');
    }
    
    if (!('serial' in navigator)) {
        issues.push('Web Serial API no soportado');
    }
    
    if (issues.length > 0) {
        showError('Problemas de compatibilidad: ' + issues.join(', '));
    }
}

// Inicializar cuando la página esté lista
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM cargado, iniciando aplicación...');
    checkBrowserSupport();
    init();
});

// Manejar errores no capturados
window.addEventListener('error', (e) => {
    console.error('Error no capturado:', e.error);
    showError('Error inesperado: ' + e.error.message);
});

// Manejar promesas rechazadas
window.addEventListener('unhandledrejection', (e) => {
    console.error('Promesa rechazada:', e.reason);
    showError('Error: ' + e.reason);
});