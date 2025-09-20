// Variables globales
let model = null;
let webcam = null;
let isModelLoaded = false;
let serialPort = null;
let writer = null;
let isConnected = false;

// Configuración
const MODEL_URL = './model/';
const CONFIDENCE_THRESHOLD = 0.6; // 60%
const BAUD_RATE = 115200;

// Referencias DOM
const video = document.getElementById('webcam');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const connectBtn = document.getElementById('connectBtn');
const connectionStatus = document.getElementById('connectionStatus');
const className = document.getElementById('className');
const confidence = document.getElementById('confidence');
const loading = document.getElementById('loading');

// Inicializar la aplicación
async function init() {
    try {
        console.log('Inicializando aplicación...');
        
        // Cargar modelo
        await loadModel();
        
        // Inicializar cámara
        await setupCamera();
        
        // Configurar eventos
        setupEventListeners();
        
        // Iniciar predicciones
        predict();
        
        loading.style.display = 'none';
        console.log('Aplicación inicializada correctamente');
        
    } catch (error) {
        console.error('Error al inicializar:', error);
        showError('Error al inicializar la aplicación: ' + error.message);
    }
}

// Cargar modelo de Teachable Machine
async function loadModel() {
    try {
        console.log('Cargando modelo desde:', MODEL_URL);
        
        // Intentar cargar el modelo
        model = await tmImage.load(MODEL_URL + 'model.json', MODEL_URL + 'metadata.json');
        
        isModelLoaded = true;
        console.log('Modelo cargado correctamente');
        console.log('Clases del modelo:', model.getClassLabels());
        
    } catch (error) {
        console.error('Error al cargar modelo:', error);
        throw new Error('No se pudo cargar el modelo. Asegúrate de que los archivos model.json y metadata.json estén en la carpeta /model/');
    }
}

// Configurar cámara web
async function setupCamera() {
    try {
        console.log('Configurando cámara...');
        
        const stream = await navigator.mediaDevices.getUserMedia({
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
    connectBtn.addEventListener('click', toggleSerialConnection);
    
    // Verificar soporte para Web Serial API
    if (!('serial' in navigator)) {
        connectBtn.disabled = true;
        connectBtn.textContent = '❌ Web Serial no soportado';
        connectionStatus.textContent = 'Web Serial API no disponible';
        connectionStatus.style.color = '#ff4444';
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
        connectBtn.textContent = '🔌 Desconectar ESP32';
        connectBtn.style.backgroundColor = '#ff4444';
        connectionStatus.textContent = 'Conectado';
        connectionStatus.style.color = '#44ff44';
        
        console.log('Conectado al ESP32');
        
    } catch (error) {
        console.error('Error al conectar:', error);
        showError('Error al conectar con ESP32: ' + error.message);
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
        connectBtn.textContent = '🔌 Conectar ESP32';
        connectBtn.style.backgroundColor = '#2196f3';
        connectionStatus.textContent = 'Desconectado';
        connectionStatus.style.color = '#666';
        
        console.log('Desconectado del ESP32');
        
    } catch (error) {
        console.error('Error al desconectar:', error);
    }
}

// Enviar datos al ESP32
async function sendToESP32(data) {
    if (!isConnected || !writer) {
        console.warn('No hay conexión con ESP32');
        return;
    }
    
    try {
        const message = data + '\n';
        const encoder = new TextEncoder();
        await writer.write(encoder.encode(message));
        console.log('Enviado al ESP32:', data);
        
    } catch (error) {
        console.error('Error al enviar datos:', error);
        showError('Error al enviar datos al ESP32');
    }
}

// Realizar predicciones en tiempo real
async function predict() {
    if (!isModelLoaded || !model) {
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
        
        // Enviar al ESP32 si la confianza es alta
        if (maxPrediction.probability > CONFIDENCE_THRESHOLD) {
            await sendToESP32(maxPrediction.className);
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