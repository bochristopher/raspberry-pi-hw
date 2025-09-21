#!/usr/bin/env node

const CameraCapture = require('./src/drivers/camera.js');

console.log('Testing USB Camera...');

const camera = new CameraCapture();

camera.initialize().then(() => {
    console.log('Camera Status:', camera.getStatus());

    // Test capturing a frame
    console.log('Capturing test frame...');

    camera.captureAndSave().then(frameData => {
        console.log('Frame captured successfully:');
        console.log('- Filename:', frameData.filename);
        console.log('- Filepath:', frameData.filepath);
        console.log('- Timestamp:', frameData.timestamp);
        console.log('- Dimensions:', frameData.width + 'x' + frameData.height);
        console.log('- Mock mode:', frameData.mock || false);
        console.log('- Base64 length:', frameData.base64Data.length, 'chars');

        camera.stop();
        process.exit(0);
    }).catch(err => {
        console.error('Frame capture failed:', err);
        process.exit(1);
    });

}).catch(err => {
    console.error('Failed to initialize camera:', err);
    process.exit(1);
});