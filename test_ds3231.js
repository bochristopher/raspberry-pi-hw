#!/usr/bin/env node

const DS3231 = require('./src/drivers/ds3231.js');

console.log('Testing DS3231 RTC...');

const rtc = new DS3231();

rtc.initialize().then(() => {
    console.log('DS3231 Status:', rtc.getStatus());

    // Test reading time
    rtc.readTime().then(time => {
        console.log('RTC Time:', time);

        // Test getting precise timestamp
        rtc.getPreciseTimestamp().then(timestamp => {
            console.log('Precise Timestamp:', timestamp);

            // Test temperature reading
            rtc.getTemperature().then(temp => {
                console.log('RTC Temperature:', temp, '°C');

                rtc.stop();
                process.exit(0);
            }).catch(err => {
                console.error('Temperature read failed:', err);
                process.exit(1);
            });

        }).catch(err => {
            console.error('Timestamp read failed:', err);
            process.exit(1);
        });

    }).catch(err => {
        console.error('Time read failed:', err);
        process.exit(1);
    });

}).catch(err => {
    console.error('Failed to initialize DS3231:', err);
    process.exit(1);
});