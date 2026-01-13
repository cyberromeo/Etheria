const https = require('https');

const url = 'https://api.nekosapi.com/v4/images/random?limit=1&rating=safe';

console.log(`Fetching ${url}...`);

https.get(url, (res) => {
    let data = '';

    console.log('Status Code:', res.statusCode);

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const json = JSON.parse(data);
                console.log('Success! Sample Item:', json[0]);
            } else {
                console.log('Error Response:', data);
            }
        } catch (e) {
            console.error('Error parsing JSON:', e);
            console.log('Raw Data:', data);
        }
    });

}).on('error', (err) => {
    console.error('Error: ' + err.message);
});
