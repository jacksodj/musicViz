# Govee Integration Module

This module provides integration with Govee smart lighting devices through both LAN (local) and Cloud APIs.

## Features

- **Device Discovery**: Automatic discovery of Govee devices on local network via UDP multicast
- **LAN Control**: Low-latency local control without internet dependency
- **Cloud API**: Full feature access through Govee's cloud API
- **Music Sync**: Extract colors from visualizations and sync to lights
- **Scene Designer**: Create and save light show patterns synced to music

## Architecture

```
src/lib/govee/
├── README.md
├── GoveeManager.js         # Main manager class
├── discovery.js            # UDP device discovery
├── lanApi.js              # LAN API communication
├── cloudApi.js            # Cloud API communication
├── colorExtractor.js      # Extract colors from visualizations
├── syncEngine.js          # Synchronization engine with latency compensation
└── types.js               # TypeScript types/JSDoc definitions
```

## Protocol Details

### LAN API (UDP)
- Discovery: Multicast to 239.255.255.250:4001
- Control: UDP messages to device IP:4001
- Response: Received on local port 4002
- Status: Query device state via port 4003

### Cloud API (HTTPS)
- Endpoint: https://developer-api.govee.com/v1/
- Auth: API key in header
- Rate limit: 100 requests per minute

## Setup Requirements

1. Enable LAN API in Govee Home app for each device
2. Ensure UDP ports 4001-4003 are accessible
3. Obtain API key from Govee Developer Platform

## Usage

```javascript
import { GoveeManager } from './GoveeManager.js';

const govee = new GoveeManager({
  apiKey: 'your-api-key',
  useLanApi: true,
  discoveryTimeout: 5000
});

// Discover devices
const devices = await govee.discoverDevices();

// Control device
await govee.setDeviceColor(deviceId, { r: 255, g: 0, b: 0 });

// Sync with visualization
govee.syncWithVisualization(canvasElement);
```