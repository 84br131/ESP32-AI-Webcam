# Modelo de Teachable Machine

## Instrucciones de uso:

1. Entrena tu modelo en [Teachable Machine](https://teachablemachine.withgoogle.com/train/image)

2. Exporta el modelo seleccionando "TensorFlow.js"

3. Descarga los archivos y coloca en esta carpeta:
   - `model.json`
   - `metadata.json`
   - `weights.bin` (si existe)

## Clases esperadas:
- Vegetal
- Plastico
- Nada

El modelo debe reconocer estas tres clases para que funcione correctamente con el ESP32.

## Notas:
- Asegúrate de que los nombres de las clases coincidan exactamente
- El modelo se carga automáticamente cuando la página se inicia
- La detección se realiza en tiempo real con un umbral de confianza del 60%