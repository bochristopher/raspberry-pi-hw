#!/usr/bin/env node

const ATECC608 = require('./src/crypto/atecc608.js');

console.log('Testing ATECC608 Crypto Chip...');

const crypto = new ATECC608();

crypto.initialize().then(() => {
    console.log('ATECC608 Status:', crypto.getStatus());

    // Test signing some data
    const testData = 'Hello, secure world!';
    console.log('Signing test data:', testData);

    crypto.signData(testData).then(signature => {
        console.log('Signature result:', signature);

        // Test verification
        crypto.verifySignature(testData, signature).then(valid => {
            console.log('Signature verification:', valid ? 'VALID' : 'INVALID');

            crypto.stop();
            process.exit(0);
        }).catch(err => {
            console.error('Verification failed:', err);
            process.exit(1);
        });

    }).catch(err => {
        console.error('Signing failed:', err);
        process.exit(1);
    });

}).catch(err => {
    console.error('Failed to initialize ATECC608:', err);
    process.exit(1);
});