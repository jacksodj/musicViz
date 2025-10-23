/// Govee UDP Communication Module
///
/// Handles UDP multicast discovery and LAN API communication
/// with Govee smart lighting devices.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::{SocketAddr, UdpSocket};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::State;

/// Govee device information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoveeDevice {
    pub id: String,
    pub name: String,
    pub model: String,
    pub ip: String,
    #[serde(rename = "lanApiEnabled")]
    pub lan_api_enabled: bool,
    pub online: bool,
    pub state: DeviceState,
    pub capabilities: DeviceCapabilities,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceState {
    pub on: bool,
    pub brightness: u8,
    pub color: RGBColor,
    #[serde(rename = "colorTemperature")]
    pub color_temperature: u16,
    pub mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RGBColor {
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceCapabilities {
    #[serde(rename = "powerControl")]
    pub power_control: bool,
    #[serde(rename = "brightnessControl")]
    pub brightness_control: bool,
    #[serde(rename = "colorControl")]
    pub color_control: bool,
    #[serde(rename = "colorTemperatureControl")]
    pub color_temperature_control: bool,
    #[serde(rename = "musicMode")]
    pub music_mode: bool,
}

/// LAN API message structure
#[derive(Debug, Serialize, Deserialize)]
struct LanMessage {
    msg: MessageContent,
}

#[derive(Debug, Serialize, Deserialize)]
struct MessageContent {
    cmd: String,
    data: serde_json::Value,
}

/// Govee manager state for Tauri
#[derive(Default)]
pub struct GoveeState {
    devices: Arc<Mutex<HashMap<String, GoveeDevice>>>,
}

/// Discover Govee devices on the local network
#[tauri::command]
pub fn govee_discover_devices(
    timeout: u32,
    multicast_group: String,
    discovery_port: u16,
    response_port: u16,
    state: State<GoveeState>,
) -> Result<Vec<GoveeDevice>, String> {
    println!("Starting Govee device discovery...");
    println!("  Multicast: {}:{}", multicast_group, discovery_port);
    println!("  Response port: {}", response_port);

    // Create UDP socket for receiving responses
    let response_addr = format!("0.0.0.0:{}", response_port);
    let response_socket = UdpSocket::bind(&response_addr)
        .map_err(|e| format!("Failed to bind response socket: {}", e))?;

    response_socket
        .set_read_timeout(Some(Duration::from_millis(timeout as u64)))
        .map_err(|e| format!("Failed to set socket timeout: {}", e))?;

    // Create UDP socket for sending discovery
    let send_socket = UdpSocket::bind("0.0.0.0:0")
        .map_err(|e| format!("Failed to bind send socket: {}", e))?;

    // Enable broadcast
    send_socket
        .set_broadcast(true)
        .map_err(|e| format!("Failed to enable broadcast: {}", e))?;

    // Create discovery message
    let discovery_msg = LanMessage {
        msg: MessageContent {
            cmd: "scan".to_string(),
            data: serde_json::json!({
                "account_topic": "reserve"
            }),
        },
    };

    let msg_bytes = serde_json::to_vec(&discovery_msg)
        .map_err(|e| format!("Failed to serialize discovery message: {}", e))?;

    // Try broadcast first (works better on some networks)
    let broadcast_addr: SocketAddr = format!("255.255.255.255:{}", discovery_port)
        .parse()
        .map_err(|e| format!("Invalid broadcast address: {}", e))?;

    println!("Sending broadcast discovery message to {}...", broadcast_addr);
    match send_socket.send_to(&msg_bytes, broadcast_addr) {
        Ok(_) => println!("Broadcast message sent successfully"),
        Err(e) => {
            println!("Broadcast failed ({}), trying multicast...", e);

            // Fallback to multicast
            let multicast_addr: SocketAddr = format!("{}:{}", multicast_group, discovery_port)
                .parse()
                .map_err(|e| format!("Invalid multicast address: {}", e))?;

            send_socket
                .send_to(&msg_bytes, multicast_addr)
                .map_err(|e| format!("Failed to send discovery message: {}", e))?;

            println!("Multicast message sent");
        }
    }

    println!("Sent discovery message, waiting for responses...");

    // Collect responses
    let mut devices = Vec::new();
    let mut buffer = [0u8; 2048];
    let start = Instant::now();
    let mut response_count = 0;

    println!("Listening for responses for {} ms...", timeout);

    while start.elapsed() < Duration::from_millis(timeout as u64) {
        match response_socket.recv_from(&mut buffer) {
            Ok((size, src_addr)) => {
                response_count += 1;
                println!("Response #{} - Received {} bytes from {}", response_count, size, src_addr);

                // Log raw response for debugging
                if let Ok(response_str) = std::str::from_utf8(&buffer[..size]) {
                    println!("  Raw response: {}", response_str);
                }

                // Parse response
                if let Ok(response) = serde_json::from_slice::<serde_json::Value>(&buffer[..size])
                {
                    if let Some(device) = parse_device_response(&response, &src_addr) {
                        println!("  ✓ Found Govee device: {} ({}) at {}", device.name, device.model, device.id);
                        devices.push(device.clone());

                        // Store in state
                        let mut state_devices = state.devices.lock().unwrap();
                        state_devices.insert(device.id.clone(), device);
                    } else {
                        println!("  ! Response received but couldn't parse as Govee device");
                    }
                } else {
                    println!("  ! Couldn't parse response as JSON");
                }
            }
            Err(e) => {
                if e.kind() != std::io::ErrorKind::WouldBlock
                   && e.kind() != std::io::ErrorKind::TimedOut {
                    println!("Error receiving response: {}", e);
                }
            }
        }
    }

    println!("Discovery complete:");
    println!("  Total responses: {}", response_count);
    println!("  Govee devices found: {}", devices.len());
    Ok(devices)
}

/// Parse device response from JSON
fn parse_device_response(response: &serde_json::Value, src_addr: &SocketAddr) -> Option<GoveeDevice> {
    let msg = response.get("msg")?;
    let cmd = msg.get("cmd")?.as_str()?;

    let data = msg.get("data")?;

    // Handle both "scan" and "devStatus" responses
    match cmd {
        "scan" => {
            // Scan response - device discovery with limited info
            println!("  Parsing 'scan' response...");

            // Get IP from response data or fall back to source address
            let device_ip = data
                .get("ip")
                .and_then(|ip| ip.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| src_addr.ip().to_string());

            Some(GoveeDevice {
                id: data.get("device")?.as_str()?.to_string(),
                name: data
                    .get("deviceName")
                    .and_then(|n| n.as_str())
                    .unwrap_or_else(|| {
                        // Generate name from model if not provided
                        data.get("sku")
                            .and_then(|s| s.as_str())
                            .unwrap_or("Govee Device")
                    })
                    .to_string(),
                model: data
                    .get("sku")
                    .and_then(|s| s.as_str())
                    .unwrap_or("Unknown")
                    .to_string(),
                ip: device_ip,
                lan_api_enabled: true,
                online: true, // If it responded, it's online
                state: DeviceState {
                    // Default state for scan responses
                    on: false,
                    brightness: 50,
                    color: RGBColor { r: 255, g: 255, b: 255 },
                    color_temperature: 5000,
                    mode: "normal".to_string(),
                },
                capabilities: DeviceCapabilities {
                    power_control: true,
                    brightness_control: true,
                    color_control: true,
                    color_temperature_control: true,
                    music_mode: true, // Most Govee lights support music mode
                },
            })
        }
        "devStatus" => {
            // Full status response with device state
            println!("  Parsing 'devStatus' response...");
            Some(GoveeDevice {
                id: data.get("device")?.as_str()?.to_string(),
                name: data
                    .get("deviceName")
                    .and_then(|n| n.as_str())
                    .unwrap_or("Unknown Device")
                    .to_string(),
                model: data
                    .get("sku")
                    .and_then(|s| s.as_str())
                    .unwrap_or("Unknown")
                    .to_string(),
                ip: src_addr.ip().to_string(),
                lan_api_enabled: true,
                online: data.get("onOff").is_some(),
                state: DeviceState {
                    on: data.get("onOff").and_then(|v| v.as_i64()).unwrap_or(0) == 1,
                    brightness: data
                        .get("brightness")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0) as u8,
                    color: parse_color(data.get("color")),
                    color_temperature: data
                        .get("colorTemInKelvin")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(5000) as u16,
                    mode: data
                        .get("mode")
                        .and_then(|m| m.as_str())
                        .unwrap_or("normal")
                        .to_string(),
                },
                capabilities: DeviceCapabilities {
                    power_control: true,
                    brightness_control: true,
                    color_control: true,
                    color_temperature_control: data.get("colorTemInKelvin").is_some(),
                    music_mode: data
                        .get("musicMode")
                        .and_then(|m| m.as_bool())
                        .unwrap_or(false),
                },
            })
        }
        _ => {
            println!("  Unknown command type: {}", cmd);
            None
        }
    }
}

/// Parse color from JSON value
fn parse_color(color_value: Option<&serde_json::Value>) -> RGBColor {
    if let Some(color) = color_value {
        RGBColor {
            r: color.get("r").and_then(|v| v.as_u64()).unwrap_or(255) as u8,
            g: color.get("g").and_then(|v| v.as_u64()).unwrap_or(255) as u8,
            b: color.get("b").and_then(|v| v.as_u64()).unwrap_or(255) as u8,
        }
    } else {
        RGBColor { r: 255, g: 255, b: 255 }
    }
}

/// Send LAN API command to a device
#[tauri::command]
pub fn govee_send_lan_command(
    device_ip: String,
    message: String,
    expect_response: bool,
    port: u16,
) -> Result<serde_json::Value, String> {
    println!("Sending command to {} on port {}", device_ip, port);
    println!("Message: {}", message);

    // Create socket
    let socket = UdpSocket::bind("0.0.0.0:0")
        .map_err(|e| format!("Failed to create socket: {}", e))?;

    if expect_response {
        socket
            .set_read_timeout(Some(Duration::from_secs(2)))
            .map_err(|e| format!("Failed to set timeout: {}", e))?;
    }

    // Send command
    let device_addr: SocketAddr = format!("{}:{}", device_ip, port)
        .parse()
        .map_err(|e| format!("Invalid device address: {}", e))?;

    socket
        .send_to(message.as_bytes(), device_addr)
        .map_err(|e| format!("Failed to send command: {}", e))?;

    if expect_response {
        // Wait for response
        let mut buffer = [0u8; 1024];
        match socket.recv_from(&mut buffer) {
            Ok((size, _)) => {
                let response = serde_json::from_slice(&buffer[..size])
                    .map_err(|e| format!("Failed to parse response: {}", e))?;
                Ok(response)
            }
            Err(e) => Err(format!("Failed to receive response: {}", e)),
        }
    } else {
        Ok(serde_json::json!({ "success": true }))
    }
}

/// Get cached device information
#[tauri::command]
pub fn govee_get_device(device_id: String, state: State<GoveeState>) -> Option<GoveeDevice> {
    let devices = state.devices.lock().unwrap();
    devices.get(&device_id).cloned()
}

/// Get all cached devices
#[tauri::command]
pub fn govee_get_all_devices(state: State<GoveeState>) -> Vec<GoveeDevice> {
    let devices = state.devices.lock().unwrap();
    devices.values().cloned().collect()
}

/// Clear cached devices
#[tauri::command]
pub fn govee_clear_devices(state: State<GoveeState>) {
    let mut devices = state.devices.lock().unwrap();
    devices.clear();
    println!("Cleared all cached Govee devices");
}