// Global UI Elements
const valPacketRate = document.getElementById('valPacketRate');
const valByteRate = document.getElementById('valByteRate');
const valEntropy = document.getElementById('valEntropy');
const valThreshold = document.getElementById('valThreshold');
const logList = document.getElementById('logList');
const systemStatusBadge = document.getElementById('systemStatusBadge');
const body = document.body;

// Chart.js Setup
const ctx = document.getElementById('trafficChart').getContext('2d');
Chart.defaults.color = '#8e8e9c';
Chart.defaults.font.family = "'JetBrains Mono', monospace";

const trafficChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: Array(30).fill(''), // X axis: 30 data points (history)
        datasets: [{
            label: 'Packets / 10s',
            data: Array(30).fill(0),
            borderColor: '#4d7cff',
            backgroundColor: 'rgba(77, 124, 255, 0.1)',
            borderWidth: 2,
            pointRadius: 0,
            fill: true,
            tension: 0.4
        }, {
            label: 'Threshold',
            data: Array(30).fill(0),
            borderColor: '#ff3366',
            borderWidth: 1,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false,
            tension: 0
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 }, // Instant updates
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(255, 255, 255, 0.05)' }
            },
            x: {
                grid: { display: false }
            }
        },
        plugins: {
            legend: { display: false }
        }
    }
});

// Helper: Add log to terminal box
function addLog(message, type = 'normal') {
    const li = document.createElement('li');
    if (type !== 'normal') li.className = type;
    
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    
    li.innerHTML = `<span class="time">[${timeStr}]</span> ${message}`;
    logList.appendChild(li);
    logList.scrollTop = logList.scrollHeight;
}

// WebSocket Connection
function connectWebSocket() {
    // Determine the WS URL based on current host (supports 127.0.0.1 or localhost)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/live`;
    
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        addLog("WebSocket connected to AI Core.", "success");
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'metrics') {
            // Update UI Numbers
            valPacketRate.innerHTML = `${data.packet_count} <span class="unit">pkts / 10s</span>`;
            valByteRate.innerText = `${data.total_bytes} bytes`;
            valEntropy.innerText = data.entropy.toFixed(2);
            valThreshold.innerText = data.threshold.toFixed(0);

            // Update Chart
            const chartData = trafficChart.data.datasets[0].data;
            const thresholdData = trafficChart.data.datasets[1].data;
            
            chartData.push(data.packet_count);
            chartData.shift();
            
            thresholdData.push(data.threshold);
            thresholdData.shift();
            
            trafficChart.update();

            // Handle UI state
            if (data.circuit_breaker_active && !body.classList.contains('attack-mode')) {
                activateCircuitBreakerUI();
            } else if (!data.circuit_breaker_active && body.classList.contains('attack-mode')) {
                deactivateCircuitBreakerUI();
            }
        } 
        else if (data.type === 'alert') {
            addLog(`🚨 ${data.message}`, "alert");
        }
    };

    ws.onclose = () => {
        addLog("WebSocket disconnected. Retrying in 2s...", "alert");
        setTimeout(connectWebSocket, 2000);
    };
}

// Start WS connection
connectWebSocket();


// UI State Toggles
function activateCircuitBreakerUI() {
    body.classList.add('attack-mode');
    systemStatusBadge.className = 'status-badge danger';
    systemStatusBadge.innerHTML = `<span class="pulse-dot"></span> THREAT ISOLATED`;
}

function deactivateCircuitBreakerUI() {
    body.classList.remove('attack-mode');
    systemStatusBadge.className = 'status-badge safe';
    systemStatusBadge.innerHTML = `<span class="pulse-dot"></span> SYSTEM SECURE`;
    addLog("Cloud NACL Reset. Monitoring resumed.", "success");
}

// API Call: Launch Attack
async function launchAttack() {
    addLog("Simulating volumetric DDoS attack...", "normal");
    
    for (let i = 0; i < 60; i++) {
        // Fire 60 fake packets rapidly
        fetch('/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                src_ip: "203.0.113." + Math.floor(Math.random() * 255),
                dst_ip: "10.0.1.19",
                length: Math.floor(Math.random() * (1500 - 500 + 1) + 500),
                protocol: "UDP"
            })
        }).catch(() => {});
    }
}

// API Call: Reset (Simulated via backend restart or script in real AWS, here we just reset UI for demo purposes)
function resetSystem() {
    addLog("Sending reset command to AWS NACL...", "normal");
    
    // In a real scenario, this would call a FastAPI /reset endpoint. 
    // Since api_server.py auto-resets the flag after 10 seconds, we just wait for the websocket to tell us it's safe.
    addLog("Wait for AI Core to resume surveillance...", "normal");
}
