#!/usr/bin/env node

const LIS3DH = require('./src/drivers/lis3dh.js');

console.log('Testing LIS3DH Accelerometer...');

const accelerometer = new LIS3DH();

accelerometer.initialize().then(() => {
    console.log('LIS3DH initialized, reading acceleration data...');

    // Test reading acceleration values
    accelerometer.readAcceleration().then(data => {
        console.log('Acceleration reading:', data);

        // Listen for motion events for 10 seconds
        console.log('Listening for motion events for 10 seconds...');
        console.log('Try moving/tapping the device!');

        accelerometer.on('motion', (data) => {
            console.log('MOTION DETECTED:', data);
        });

        setTimeout(() => {
            console.log('Test complete, stopping accelerometer...');
            accelerometer.stop();
            process.exit(0);
        }, 10000);

    }).catch(err => {
        console.error('Failed to read acceleration:', err);
        process.exit(1);
    });

}).catch(err => {
    console.error('Failed to initialize LIS3DH:', err);
    process.exit(1);
});