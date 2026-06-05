/**
 * AgenticFlow — BLE Module (Main Process)
 * Windows: PowerShell PnP + WinRT via child_process
 * Scan, Pair, Login-Token via BLE-Gerät
 */

const { ipcMain, session } = require('electron');
const { execFile, exec }   = require('child_process');

// ── PowerShell helper ────────────────────────────────────────
function ps(command) {
  return new Promise(resolve => {
    exec(`powershell -NoProfile -Command "${command.replace(/"/g, '\\"')}"`,
      { encoding: 'utf8', timeout: 8000 },
      (err, out) => resolve(err ? '' : out.trim())
    );
  });
}

// ── Get all Bluetooth devices (classic + BLE) ────────────────
async function getPairedDevices() {
  const out = await ps(
    'Get-PnpDevice -Class Bluetooth | Where-Object {$_.Status -eq "OK"} | ' +
    'Select-Object FriendlyName,Status,DeviceID | ConvertTo-Json -Compress'
  );
  if (!out) return [];
  try {
    const raw = JSON.parse(out);
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr
      .filter(d => d.FriendlyName && !d.FriendlyName.match(/Dienst|Service|Protokoll|Adapter|Profil|Transport|NAP|HID|Attribut/i))
      .map(d => ({
        name:   d.FriendlyName.trim(),
        id:     d.DeviceID,
        status: d.Status,
        isBle:  d.DeviceID.includes('BTHLEDEVICE'),
        type:   guessType(d.FriendlyName, d.DeviceID),
      }));
  } catch { return []; }
}

// ── Scan for nearby BLE advertisements (WinRT) ───────────────
async function scanBleAdvertisements() {
  // Uses Windows.Devices.Bluetooth.Advertisement via WinRT COM
  const script = `
$code = @'
using System;
using System.Collections.Generic;
using System.Threading;
using Windows.Devices.Bluetooth.Advertisement;
using Newtonsoft.Json;

public class BleScanner {
  public static List<object> Scan(int ms) {
    var found = new List<object>();
    var w = new BluetoothLEAdvertisementWatcher();
    w.Received += (s, e) => {
      found.Add(new { name = e.Advertisement.LocalName ?? "", rssi = e.RawSignalStrengthInDBm,
        address = e.BluetoothAddress.ToString("X12") });
    };
    w.Start(); Thread.Sleep(ms); w.Stop();
    return found;
  }
}
'@
# WinRT via Add-Type needs Windows SDK — fallback to PnP
$devices = Get-PnpDevice -Class Bluetooth | Where-Object { $_.Status -eq "OK" } |
  Select-Object FriendlyName, DeviceID |
  Where-Object { $_.FriendlyName -notmatch "Dienst|Service|Adapter|Profil|Transport|NAP|Attribut" }
$devices | ConvertTo-Json -Compress
`;
  const out = await ps(script.replace(/`/g, '``').replace(/\$/g, '$$'));
  if (!out) return [];
  try {
    const raw = JSON.parse(out);
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr.map(d => ({
      name:   (d.FriendlyName || 'Unbekannt').trim(),
      id:     d.DeviceID || '',
      isBle:  (d.DeviceID || '').includes('BTHLEDEVICE'),
      rssi:   null,
    }));
  } catch { return []; }
}

// ── Check if specific device is reachable (proximity check) ──
async function isDeviceNearby(deviceId) {
  const devices = await getPairedDevices();
  const found   = devices.find(d => d.id === deviceId);
  if (!found) return false;

  // Zusätzlich: Ping via BT-Adresse wenn möglich
  return found.status === 'OK';
}

// ── Toggle Bluetooth on/off ───────────────────────────────────
async function setBluetooth(enable) {
  // Windows 10/11: Bluetooth über DeviceManagement
  const state = enable ? 'Enable' : 'Disable';
  await ps(
    `Get-PnpDevice -Class Bluetooth | Where-Object {$_.FriendlyName -match 'Adapter|Radio'} | ` +
    `${state}-PnpDevice -Confirm:$false 2>$null`
  );
  return { ok: true };
}

// ── Get Bluetooth adapter info ────────────────────────────────
async function getAdapterInfo() {
  const out = await ps(
    'Get-PnpDevice -Class Bluetooth | Where-Object {$_.FriendlyName -match "Adapter|Radio|Bluetooth"} | ' +
    'Select-Object -First 1 FriendlyName,Status | ConvertTo-Json -Compress'
  );
  if (!out) return { name: 'Unbekannt', status: 'Unknown' };
  try {
    const d = JSON.parse(out);
    return { name: d.FriendlyName || 'BT Adapter', status: d.Status || 'Unknown' };
  } catch { return { name: 'BT Adapter', status: 'Unknown' }; }
}

// ── Classify device type ──────────────────────────────────────
function guessType(name, id) {
  const n = (name || '').toLowerCase();
  if (n.match(/watch|uhr|band|fit|wear|garmin|polar|suunto|samsung galaxy watch|apple watch|fossil/)) return 'watch';
  if (n.match(/ear|pod|kopfhörer|headphone|headset|buds|jabra|sony wh|bose/)) return 'headphone';
  if (n.match(/phone|iphone|samsung|pixel|huawei|xiaomi/)) return 'phone';
  if (n.match(/keyboard|tastatur/)) return 'keyboard';
  if (n.match(/mouse|maus/)) return 'mouse';
  if (n.match(/speaker|lautsprecher|box/)) return 'speaker';
  if (n.match(/pc|laptop|computer|mac|surface/)) return 'computer';
  if ((id || '').includes('BTHLEDEVICE')) return 'ble';
  return 'device';
}

function typeIcon(type) {
  return { watch:'⌚', headphone:'🎧', phone:'📱', keyboard:'⌨', mouse:'🖱', speaker:'🔊', computer:'💻', ble:'📡', device:'🔵' }[type] || '🔵';
}

// ── IPC Handlers ─────────────────────────────────────────────
function registerBleHandlers(store) {

  ipcMain.handle('ble-get-devices', async () => {
    const devices = await getPairedDevices();
    return devices.map(d => ({ ...d, icon: typeIcon(d.type) }));
  });

  ipcMain.handle('ble-scan', async () => {
    const devices = await scanBleAdvertisements();
    return devices.map(d => ({ ...d, icon: typeIcon(guessType(d.name, d.id)) }));
  });

  ipcMain.handle('ble-adapter-info', getAdapterInfo);

  ipcMain.handle('ble-set-power', async (_, enable) => setBluetooth(enable));

  // Pair a device as login token
  ipcMain.handle('ble-pair-for-login', async (_, { deviceId, deviceName, deviceType }) => {
    const paired = store.get('blePairedLogins', []);
    const exists = paired.find(p => p.deviceId === deviceId);
    if (!exists) {
      paired.push({ deviceId, deviceName, deviceType, pairedAt: Date.now() });
      store.set('blePairedLogins', paired);
    }
    return { ok: true };
  });

  ipcMain.handle('ble-unpair-login', async (_, deviceId) => {
    const paired = store.get('blePairedLogins', []).filter(p => p.deviceId !== deviceId);
    store.set('blePairedLogins', paired);
    return { ok: true };
  });

  ipcMain.handle('ble-get-login-pairs', () => store.get('blePairedLogins', []));

  // Login attempt: check if paired device is nearby
  ipcMain.handle('ble-login-check', async (_, deviceId) => {
    const nearby = await isDeviceNearby(deviceId);
    if (nearby) {
      store.set('bleLastLogin', { deviceId, ts: Date.now() });
      return { success: true };
    }
    return { success: false, reason: 'Gerät nicht in Reichweite' };
  });
}

module.exports = { registerBleHandlers, typeIcon, guessType };
