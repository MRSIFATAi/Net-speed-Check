// Global variables
let testing = false;
let testType = '';
let downloadSpeed = 0;
let uploadSpeed = 0;
let currentSpeed = 0;
let abortController = null;
let testHistory = [];
let animationFrame = null;

// DOM elements
const speedNeedle = document.getElementById('speedNeedle');
const speedValue = document.getElementById('speedValue');
const speedLabel = document.getElementById('speedLabel');
const speedProgress = document.getElementById('speedProgress');
const downloadSpeedEl = document.getElementById('downloadSpeed');
const uploadSpeedEl = document.getElementById('uploadSpeed');
const startBtn = document.getElementById('startBtn');
const startIcon = document.getElementById('startIcon');
const startText = document.getElementById('startText');
const historyPanel = document.getElementById('historyPanel');
const historyContent = document.getElementById('historyContent');

// Utility functions
function formatSpeed(bitsPerSecond) {
    if (!bitsPerSecond) return '0.00';
    const mbps = bitsPerSecond / (1024 * 1024);
    return mbps.toFixed(2);
}

function updateGauge(speed) {
    const maxSpeed = 300; // Mbps
    const speedMbps = speed / (1024 * 1024);
    const percentage = Math.min(speedMbps / maxSpeed, 1);
    const rotation = percentage * 180 - 90; // -90 to 90 degrees
    speedNeedle.style.transform = `rotate(${rotation}deg)`;
}

function animateSpeed(targetSpeed) {
    const increment = targetSpeed / 50;
    let current = 0;
    
    function animate() {
        if (current < targetSpeed) {
            current += increment;
            currentSpeed = Math.min(current, targetSpeed);
            speedValue.textContent = formatSpeed(currentSpeed);
            updateGauge(currentSpeed);
            animationFrame = requestAnimationFrame(animate);
        } else {
            currentSpeed = targetSpeed;
            speedValue.textContent = formatSpeed(currentSpeed);
            updateGauge(currentSpeed);
        }
    }
    
    animate();
}

// Speed test functions
async function testDownloadSpeed() {
    const testSizes = [1, 2, 5]; // MB
    let bestSpeed = 0;

    for (let size of testSizes) {
        try {
            const url = `https://httpbin.org/bytes/${size * 1024 * 1024}`;
            const startTime = performance.now();
            
            const response = await fetch(url, {
                signal: abortController?.signal,
                cache: 'no-store'
            });
            
            if (!response.ok) continue;
            
            const reader = response.body.getReader();
            let receivedLength = 0;
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                receivedLength += value.length;
                
                const currentTime = performance.now();
                const elapsed = (currentTime - startTime) / 1000;
                if (elapsed > 0) {
                    const speed = (receivedLength * 8) / elapsed;
                    if (speed > bestSpeed) {
                        bestSpeed = speed;
                        downloadSpeed = speed;
                        downloadSpeedEl.textContent = `${formatSpeed(speed)} Mbps`;
                        animateSpeed(speed);
                    }
                }
            }
            
        } catch (error) {
            if (error.name === 'AbortError') break;
            console.warn(`Download test failed for ${size}MB:`, error);
        }
    }
}

async function testUploadSpeed() {
    const testSizes = [0.5, 1, 2]; // MB
    let bestSpeed = 0;

    for (let size of testSizes) {
        try {
            const data = new Uint8Array(size * 1024 * 1024);
            crypto.getRandomValues(data);
            
            const startTime = performance.now();
            
            const response = await fetch('https://httpbin.org/post', {
                method: 'POST',
                body: data,
                signal: abortController?.signal,
                headers: {
                    'Content-Type': 'application/octet-stream'
                }
            });
            
            if (!response.ok) continue;
            
            await response.text();
            const endTime = performance.now();
            const duration = (endTime - startTime) / 1000;
            const speed = (data.length * 8) / duration;
            
            if (speed > bestSpeed) {
                bestSpeed = speed;
                uploadSpeed = speed;
                uploadSpeedEl.textContent = `${formatSpeed(speed)} Mbps`;
                animateSpeed(speed);
            }
            
        } catch (error) {
            if (error.name === 'AbortError') break;
            console.warn(`Upload test failed for ${size}MB:`, error);
        }
    }
}

// Main test function
async function runSpeedTest() {
    testing = true;
    downloadSpeed = 0;
    uploadSpeed = 0;
    currentSpeed = 0;
    abortController = new AbortController();

    // Update UI
    startBtn.className = 'btn btn-stop';
    startIcon.innerHTML = '<div class="spinner"></div>';
    startText.textContent = 'Stop Test';
    
    speedValue.textContent = '0.00';
    downloadSpeedEl.textContent = '0.00 Mbps';
    uploadSpeedEl.textContent = '0.00 Mbps';
    updateGauge(0);

    try {
        // Test download speed
        testType = 'download';
        speedLabel.textContent = 'Testing download...';
        await testDownloadSpeed();
        
        if (abortController?.signal.aborted) return;
        
        // Test upload speed
        testType = 'upload';
        speedLabel.textContent = 'Testing upload...';
        await testUploadSpeed();

        // Save to history
        const testResult = {
            id: Date.now(),
            download: downloadSpeed,
            upload: uploadSpeed,
            timestamp: new Date().toLocaleString()
        };
        testHistory.unshift(testResult);
        testHistory = testHistory.slice(0, 10); // Keep last 10 results
        updateHistoryDisplay();
        
    } catch (error) {
        console.error('Speed test error:', error);
    } finally {
        testing = false;
        testType = '';
        speedLabel.textContent = 'Mbps';
        
        // Reset UI
        startBtn.className = 'btn btn-start';
        startIcon.textContent = '▶';
        startText.textContent = 'Start Test';
    }
}

function stopSpeedTest() {
    if (abortController) {
        abortController.abort();
    }
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
    }
    testing = false;
    testType = '';
    speedLabel.textContent = 'Mbps';
    
    // Reset UI
    startBtn.className = 'btn btn-start';
    startIcon.textContent = '▶';
    startText.textContent = 'Start Test';
}

// Event handlers
function toggleSpeedTest() {
    if (testing) {
        stopSpeedTest();
    } else {
        runSpeedTest();
    }
}

function toggleHistory() {
    historyPanel.classList.toggle('show');
}

function updateHistoryDisplay() {
    if (testHistory.length === 0) {
        historyContent.innerHTML = '<p style="text-align: center; color: #9ca3af;">No tests yet</p>';
        return;
    }

    const historyHTML = testHistory.map(test => `
        <div class="history-item">
            <div class="history-date">${test.timestamp}</div>
            <div class="history-speeds">
                <span class="speed-down">↓ ${formatSpeed(test.download)} Mbps</span>
                <span class="speed-up">↑ ${formatSpeed(test.upload)} Mbps</span>
            </div>
        </div>
    `).join('');

    historyContent.innerHTML = historyHTML;
}

// Load history from localStorage on page load
function loadHistory() {
    try {
        const savedHistory = localStorage.getItem('speedtest-history');
        if (savedHistory) {
            testHistory = JSON.parse(savedHistory);
            updateHistoryDisplay();
        }
    } catch (error) {
        console.warn('Failed to load history:', error);
    }
}

// Save history to localStorage
function saveHistory() {
    try {
        localStorage.setItem('speedtest-history', JSON.stringify(testHistory));
    } catch (error) {
        console.warn('Failed to save history:', error);
    }
}

// Initialize app
function initializeApp() {
    updateGauge(0);
    loadHistory();
    
    // Save history whenever it changes
    const originalUpdateHistory = updateHistoryDisplay;
    updateHistoryDisplay = function() {
        originalUpdateHistory();
        saveHistory();
    };
}

// Run initialization when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}