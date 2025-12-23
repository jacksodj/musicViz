exports.handler = async (event) => {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Connecting to MusicViz...</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; background: #121212; color: white; text-align: center; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
        .spinner { width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.1); border-top: 4px solid #1db954; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .error { color: #ff6b6b; max-width: 400px; margin-top: 20px; }
        .btn { background: #1db954; color: white; border: none; padding: 10px 20px; border-radius: 20px; font-weight: bold; text-decoration: none; margin-top: 20px; display: inline-block; }
    </style>
</head>
<body>
    <div id="status">
        <div class="spinner"></div>
        <p>Connecting to your TV...</p>
    </div>

    <script>
        const params = new URLSearchParams(window.location.search);
        const localIp = params.get('local_ip');
        const code = params.get('code');
        const error = params.get('error');
        const state = params.get('state'); 

        const statusDiv = document.getElementById('status');

        if (error) {
            statusDiv.innerHTML = \`<p class="error">Authentication Error: \${error}</p><a href="/" class="btn">Try Again</a>\`;
        } 
        else if (code && state) {
            // RETURNING FROM SPOTIFY
            // state contains the local_ip we sent earlier
            const targetUrl = \`http://\${state}/callback?code=\${code}\`;
            statusDiv.innerHTML = \`<div class="spinner"></div><p>Finishing login...</p>\`;
            window.location.href = targetUrl;
        } 
        else if (localIp) {
            // INITIATING LOGIN (Optional, if we want to start flow from here)
            const authUrl = params.get('auth_url');
            if (authUrl) {
                window.location.href = authUrl;
            } else {
                statusDiv.innerHTML = \`<p class="error">Missing auth_url parameter</p>\`;
            }
        } else {
            statusDiv.innerHTML = \`<p>MusicViz Auth Relay</p><p style="color:#888; font-size: 0.9em">This page helps connect your phone to your TV.</p>\`;
        }
    </script>
</body>
</html>
    `;

    return {
        statusCode: 200,
        headers: {
            "Content-Type": "text/html",
        },
        body: html,
    };
};
