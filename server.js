const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

const PORT = process.env.PORT || 3000;
const BUILD_PATH = path.join(__dirname, 'frontend_rebalanceo/dist');

console.log('--- STARTING SERVER ---');
console.log(`PORT: ${PORT}`);
console.log(`Current Directory: ${__dirname}`);
console.log(`Build Path: ${BUILD_PATH}`);

// Check if build directory exists
if (fs.existsSync(BUILD_PATH)) {
    console.log('Build directory exists.');
    console.log('Contents:', fs.readdirSync(BUILD_PATH));
} else {
    console.error('CRITICAL: Build directory DOES NOT EXIST at ' + BUILD_PATH);
}

// Check index.html
const indexPath = path.join(BUILD_PATH, 'index.html');
if (fs.existsSync(indexPath)) {
    console.log('index.html found.');
} else {
    console.error('CRITICAL: index.html NOT FOUND at ' + indexPath);
}

// Health check endpoint (for Railway to ping)
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Serve static files from the React app build directory
app.use(express.static(BUILD_PATH));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(500).send('Application Error: Build not found. Check logs.');
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
