const baseUrl = process.env.MDM_API_URL ?? "http://127.0.0.1:8080";
const adminUser = process.env.MDM_ADMIN_USER ?? "admin";
const adminPass = process.env.MDM_ADMIN_PASS ?? "admin123";
const requestedDeviceId = process.env.MDM_DEVICE_ID ?? null;

const warnings = [];

function logPass(step, detail) {
  console.log(`[PASS] ${step}: ${detail}`);
}

function logWarn(step, detail) {
  const line = `[WARN] ${step}: ${detail}`;
  warnings.push(line);
  console.warn(line);
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeAllowedApps(items) {
  return Array.from(new Set((items ?? []).map((item) => String(item).trim()).filter(Boolean))).sort();
}

function makeUrl(path) {
  return new URL(path, baseUrl).toString();
}

async function request(path, options = {}) {
  const {
    method = "GET",
    token,
    body,
    expected = [200],
  } = options;

  const headers = {
    Accept: "application/json",
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(makeUrl(path), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!expected.includes(response.status)) {
    throw new Error(`${method} ${path} -> ${response.status} ${text}`.trim());
  }

  return { status: response.status, data, text };
}

async function optionalRead(path, token, step, expected = [200, 404]) {
  const response = await request(path, { token, expected });
  if (response.status === 404) {
    logWarn(step, `returned 404 for ${path}`);
  } else {
    logPass(step, `${path} returned ${response.status}`);
  }
}

let createdProfileId = null;

try {
  const login = await request("/api/auth/login", {
    method: "POST",
    body: { username: adminUser, password: adminPass },
  });
  ensure(login.data?.token, "Admin login did not return token");
  ensure(String(login.data?.role ?? "").toUpperCase() === "ADMIN", "Login did not return ADMIN role");
  const token = login.data.token;
  logPass("login", `token acquired for ${adminUser}`);

  const devices = await request("/api/admin/devices", { token });
  ensure(Array.isArray(devices.data), "Device list did not return an array");
  logPass("device list", `${devices.data.length} device(s) visible`);

  const deviceId = requestedDeviceId ?? devices.data[0]?.id ?? null;
  if (!deviceId) {
    throw new Error("No device found for detail/command smoke. Register Android first or set MDM_DEVICE_ID.");
  }

  const deviceDetail = await request(`/api/admin/devices/${deviceId}`, { token });
  ensure(deviceDetail.data?.id === deviceId, "Device detail did not match requested id");
  logPass("device detail", `loaded ${deviceDetail.data.deviceCode ?? deviceId}`);

  await request(`/api/admin/devices/${deviceId}/commands?limit=20&offset=0`, { token });
  logPass("device commands", "command timeline endpoint reachable");

  await optionalRead(`/api/admin/devices/${deviceId}/location/latest`, token, "device location");
  await optionalRead(`/api/admin/devices/${deviceId}/events?limit=8`, token, "device events", [200]);
  await optionalRead(`/api/admin/devices/${deviceId}/usage/summary`, token, "device usage", [200]);
  await optionalRead(`/api/admin/devices/${deviceId}/telemetry/summary`, token, "device telemetry", [200]);
  await optionalRead(`/api/admin/devices/${deviceId}/apps`, token, "device app inventory");

  const profilesBefore = await request("/api/admin/profiles", { token });
  ensure(Array.isArray(profilesBefore.data), "Profile list did not return an array");
  logPass("profile list", `${profilesBefore.data.length} profile(s) visible`);

  const smokeId = `${Date.now()}`;
  const createProfile = await request("/api/admin/profiles", {
    method: "POST",
    token,
    expected: [201],
    body: {
      userCode: `T9${smokeId}`,
      name: `Ticket9 ${smokeId}`,
      description: "ticket9 smoke profile",
      allowedApps: ["com.android.settings"],
      disableWifi: false,
      disableBluetooth: false,
      disableCamera: false,
      disableStatusBar: true,
      kioskMode: true,
      blockUninstall: true,
    },
  });
  createdProfileId = createProfile.data?.id ?? null;
  ensure(createdProfileId, "Profile create did not return id");
  logPass("profile create", `created profile ${createdProfileId}`);

  await request(`/api/admin/profiles/${createdProfileId}`, {
    method: "PUT",
    token,
    body: {
      name: `Ticket9 Updated ${smokeId}`,
      description: "ticket9 smoke profile updated",
      disableWifi: true,
      disableBluetooth: true,
      disableCamera: true,
      disableStatusBar: true,
      kioskMode: true,
      blockUninstall: true,
      lockPrivateDnsConfig: true,
      lockVpnConfig: true,
      blockDebuggingFeatures: true,
      disableUsbDataSignaling: true,
      disallowSafeBoot: true,
      disallowFactoryReset: true,
    },
  });
  logPass("profile update", `updated profile ${createdProfileId}`);

  await request(`/api/admin/profiles/${createdProfileId}/allowed-apps`, {
    method: "PUT",
    token,
    body: ["com.android.settings", "com.android.chrome", "com.google.android.apps.maps"],
  });
  logPass("allowed apps edit", `updated profile ${createdProfileId} allowedApps`);

  const profileDetail = await request(`/api/admin/profiles/${createdProfileId}`, { token });
  ensure(Array.isArray(profileDetail.data?.allowedApps), "Profile detail missing allowedApps");
  ensure(profileDetail.data?.name === `Ticket9 Updated ${smokeId}`, "Profile readback mismatch: name");
  ensure(profileDetail.data?.description === "ticket9 smoke profile updated", "Profile readback mismatch: description");
  ensure(profileDetail.data?.disableWifi === true, "Profile readback mismatch: disableWifi");
  ensure(profileDetail.data?.disableBluetooth === true, "Profile readback mismatch: disableBluetooth");
  ensure(profileDetail.data?.disableCamera === true, "Profile readback mismatch: disableCamera");
  ensure(profileDetail.data?.disableStatusBar === true, "Profile readback mismatch: disableStatusBar");
  ensure(profileDetail.data?.kioskMode === true, "Profile readback mismatch: kioskMode");
  ensure(profileDetail.data?.blockUninstall === true, "Profile readback mismatch: blockUninstall");
  ensure(profileDetail.data?.lockPrivateDnsConfig === true, "Profile readback mismatch: lockPrivateDnsConfig");
  ensure(profileDetail.data?.lockVpnConfig === true, "Profile readback mismatch: lockVpnConfig");
  ensure(profileDetail.data?.blockDebuggingFeatures === true, "Profile readback mismatch: blockDebuggingFeatures");
  ensure(profileDetail.data?.disableUsbDataSignaling === true, "Profile readback mismatch: disableUsbDataSignaling");
  ensure(profileDetail.data?.disallowSafeBoot === true, "Profile readback mismatch: disallowSafeBoot");
  ensure(profileDetail.data?.disallowFactoryReset === true, "Profile readback mismatch: disallowFactoryReset");
  const expectedAllowedApps = normalizeAllowedApps([
    "com.android.settings",
    "com.android.chrome",
    "com.google.android.apps.maps",
  ]);
  const actualAllowedApps = normalizeAllowedApps(profileDetail.data?.allowedApps);
  ensure(
    expectedAllowedApps.join("|") === actualAllowedApps.join("|"),
    `Profile readback mismatch: allowedApps expected=${expectedAllowedApps.join(",")} actual=${actualAllowedApps.join(",")}`,
  );
  logPass("profile detail", `loaded profile ${profileDetail.data.userCode ?? createdProfileId}`);

  const createCommand = await request(`/api/admin/devices/${deviceId}/commands`, {
    method: "POST",
    token,
    expected: [201],
    body: {
      type: "refresh_config",
      payload: "{}",
      ttlSeconds: 600,
    },
  });
  const commandId = createCommand.data?.id;
  ensure(commandId, "Command create did not return id");
  logPass("command create", `created command ${commandId}`);

  const cancelCommand = await request(`/api/admin/devices/${deviceId}/commands/${commandId}/cancel`, {
    method: "POST",
    token,
    body: {
      reason: "Ticket 9 smoke cleanup",
    },
  });
  ensure(String(cancelCommand.data?.status ?? "").toUpperCase() === "CANCELLED", "Command cancel did not return CANCELLED");
  logPass("command cancel", `cancelled command ${commandId}`);

  const audit = await request("/api/admin/audit?limit=20&offset=0", { token });
  ensure(Array.isArray(audit.data?.items), "Audit list did not return items");
  logPass("audit list", `${audit.data.items.length} audit row(s) returned`);

  console.log("[PASS] smoke summary: web API smoke completed");
  if (warnings.length > 0) {
    console.log(`[WARN] smoke summary: ${warnings.length} warning(s); see lines above`);
  }
} catch (error) {
  console.error(`[FAIL] smoke: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  if (createdProfileId) {
    try {
      const login = await request("/api/auth/login", {
        method: "POST",
        body: { username: adminUser, password: adminPass },
      });
      await request(`/api/admin/profiles/${createdProfileId}`, {
        method: "DELETE",
        token: login.data?.token,
        expected: [200, 404],
      });
      console.log(`[PASS] cleanup: profile ${createdProfileId} deleted`);
    } catch (error) {
      console.warn(`[WARN] cleanup: failed to delete profile ${createdProfileId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}