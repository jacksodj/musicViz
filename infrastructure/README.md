# AWS Relay Deployment Guide

This guide explains how to deploy the MusicViz Auth Relay using AWS Lambda, API Gateway, and Route53.

## 1. Create the Lambda Function
1.  Go to the **AWS Lambda Console**.
2.  Click **Create function**.
3.  Name: `musicviz-auth-relay`.
4.  Runtime: `Node.js 20.x`.
5.  Copy the code from `infrastructure/lambda/index.js` into the code editor.
6.  Click **Deploy**.

## 2. Expose via API Gateway (or Function URL)
**Option A: Function URL (Simplest)**
1.  In the Lambda Console, go to **Configuration** > **Function URL**.
2.  Click **Create function URL**.
3.  Auth type: `NONE` (Public).
4.  Save. You will get a URL like `https://<id>.lambda-url.us-east-1.on.aws/`.

**Option B: API Gateway (For Custom Domain)**
1.  Go to **API Gateway Console**.
2.  Create a **HTTP API**.
3.  Add Integration: Select your `musicviz-auth-relay` Lambda.
4.  Route: `GET /relay` (or just `/`).
5.  Deploy.

## 3. Configure Route53 (Custom Domain)
1.  Go to **API Gateway** > **Custom domain names**.
2.  Create a domain name (e.g., `auth.yourdomain.com`).
3.  Upload your ACM Certificate (you need one for HTTPS).
4.  Configure API mapping to point to your HTTP API.
5.  Go to **Route53**.
6.  Create an `A` record (Alias) pointing to the API Gateway domain name.

## 4. Update App Configuration
1.  Get your final URL (e.g., `https://auth.yourdomain.com/relay`).
2.  Update your `.env` file in the project:
    ```
    VITE_SPOTIFY_RELAY_URL=https://auth.yourdomain.com/relay
    ```
3.  Update **Spotify Developer Dashboard**:
    *   Add `https://auth.yourdomain.com/relay` to the Redirect URIs.
