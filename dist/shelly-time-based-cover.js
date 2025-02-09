"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
String.prototype.concat = function () {
    var strings = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        strings[_i] = arguments[_i];
    }
    var s = this;
    for (var _a = 0, strings_1 = strings; _a < strings_1.length; _a++) {
        var other = strings_1[_a];
        s += other;
    }
    return s;
};
function normalizeMac(originalMac) {
    var mac = "";
    for (var i = 0; i < originalMac.length; i = i + 2) {
        if (mac.length !== 0) {
            mac += ":";
        }
        mac += originalMac.substring(i, i + 2);
    }
    return mac;
}
var INITIAL_DELAY_MS = 1000;
function withExponentialBackoffRetry(title, callback, initialDelayMs) {
    if (initialDelayMs === void 0) { initialDelayMs = INITIAL_DELAY_MS; }
    console.log(title);
    var success = false;
    try {
        success = callback();
    }
    catch (e) {
        console.log("ERROR", e);
    }
    if (!success) {
        var nextDelayMs_1 = initialDelayMs > TEN_MINUTES_MS ? initialDelayMs * 2 : INITIAL_DELAY_MS;
        console.log('Will retry "' + title + '" in ' + nextDelayMs_1 / 60 + "s");
        Timer.set(initialDelayMs, false, function () {
            return withExponentialBackoffRetry(title, callback, nextDelayMs_1);
        });
    }
}
function duration(_a) {
    var millis = _a.millis, seconds = _a.seconds, minutes = _a.minutes, hours = _a.hours;
    var timestamp = (millis !== null && millis !== void 0 ? millis : 0) +
        (seconds !== null && seconds !== void 0 ? seconds : 0) * 1000 +
        (minutes !== null && minutes !== void 0 ? minutes : 0) * 1000 * 60 +
        (hours !== null && hours !== void 0 ? hours : 0) * 1000 * 60 * 60;
    return {
        asMillis: timestamp,
        asSeconds: timestamp / 1000,
    };
}
function startTimeout(duration) {
    var startInstant = Shelly.getComponentStatus("sys").uptime;
    var expirationInstant = startInstant + duration.asSeconds;
    return {
        isExpired: function () {
            var currentInstant = Shelly.getComponentStatus("sys").uptime;
            return expirationInstant < currentInstant;
        },
    };
}
function repeat(_a) {
    var every = _a.every, action = _a.action, until = _a.until, _b = _a.timeout, timeout = _b === void 0 ? duration({ minutes: 1 }) : _b;
    var timeoutClock = startTimeout(timeout);
    var handle = undefined;
    var execute = function () {
        if (!until() && !timeoutClock.isExpired()) {
            action();
            handle = Timer.set(every.asMillis, false, execute);
        }
    };
    execute();
    return {
        cancel: function () {
            if (handle) {
                Timer.clear(handle);
            }
        },
    };
}
function tryMqttPublish(topic, payload, retain) {
    if (retain === void 0) { retain = false; }
    var payloadString = JSON.stringify(payload);
    //console.log(`publishing ${topic}: ${payloadString.substring(0, 30)}`);
    MQTT.publish(topic, payloadString, 0, retain);
}
function announce() {
    var ipAddr = Shelly.getComponentStatus("wifi").sta_ip;
    var baseConfig = {
        "~": topic_prefix,
        origin: {
            name: "shelly-ha-mqtt-auto-discovery",
            sw_version: "0.1",
            support_url: "https://gist.github.com/jeremiehuchet/84e8dc96573e37200c2ab3bd4e013729",
        },
        device: {
            configuration_url: ipAddr ? "http://".concat(ipAddr) : undefined,
            connections: [["mac", normalizeMac(info.mac)]],
            hw_version: info.gen,
            identifiers: [info.id],
            manufacturer: "Shelly",
            model: info.model,
            name: info.name,
            sw_version: info.ver,
        },
        availability: [
            {
                topic: "~/online",
                payload_available: "true",
                payload_not_available: "false",
            },
        ],
        qos: 1,
    };
    var entities = [
        {
            type: "cover",
            config: __assign(__assign({}, baseConfig), { has_entity_name: true, command_topic: "~/command/cover:0", device_class: "shutter", payload_close: "close", payload_open: "open", payload_stop: "stop", position_closed: 0, position_open: 100, position_topic: "~/position", set_position_topic: "~/position/set", state_closed: "closed", state_closing: "closing", state_open: "open", state_opening: "opening", state_stopped: "stopped", state_topic: "~/state", unique_id: info.id, value_template: "{{ value_json.state }}" }),
        },
        {
            type: "sensor",
            config: __assign(__assign({}, baseConfig), { device_class: "temperature", name: "Device temperature", entity_category: "diagnostic", unique_id: info.id + "_device_temp", state_class: "measurement", state_topic: "~/state", value_template: "{{ value_json.temperature.tC }}", unit_of_measurement: "°C" }),
        },
        {
            type: "binary_sensor",
            config: __assign(__assign({}, baseConfig), { device_class: "problem", name: "Restart required", entity_category: "diagnostic", unique_id: info.id + "_restart_required", state_topic: "~/state", value_template: "{{ value_json.restart_required }}", payload_on: true, payload_off: false }),
        },
        {
            type: "sensor",
            config: __assign(__assign({}, baseConfig), { device_class: "date", name: "Last restart", entity_category: "diagnostic", unique_id: info.id + "_last_restart", state_class: "measurement", state_topic: "~/state", value_template: "{{ value_json.lastRestart | timestamp_local }}" }),
        },
        {
            type: "sensor",
            config: __assign(__assign({}, baseConfig), { entity_category: "diagnostic", device_class: "signal_strength", state_topic: "~/state", name: "Wifi signal strength", unique_id: info.id + "_wifi_rssi", state_class: "measurement", value_template: "{{ value_json.wifi.rssi }}", unit_of_measurement: "dBm" }),
        },
        {
            type: "sensor",
            config: __assign(__assign({}, baseConfig), { entity_category: "diagnostic", state_topic: "~/state", name: "Wifi SSID", unique_id: info.id + "_wifi_ssid", icon: "mdi:wifi-settings", value_template: "{{ value_json.wifi.ssid }}" }),
        },
        {
            type: "sensor",
            config: __assign(__assign({}, baseConfig), { entity_category: "diagnostic", state_topic: "~/state", name: "Wifi IP address", unique_id: info.id + "_wifi_ip", icon: "mdi:ip-outline", value_template: "{{ value_json.wifi.sta_ip }}" }),
        },
        {
            type: "sensor",
            config: __assign(__assign({}, baseConfig), { enabled_by_default: false, device_class: "power", state_class: "measurement", state_topic: "~/state", name: "Power", unique_id: info.id + "_apower", value_template: "{{ value_json.apower }}", unit_of_measurement: "W", suggested_display_precision: 1 }),
        },
        {
            type: "sensor",
            config: __assign(__assign({}, baseConfig), { enabled_by_default: false, device_class: "voltage", state_class: "measurement", state_topic: "~/state", name: "Voltage", unique_id: info.id + "_voltage", value_template: "{{ value_json.voltage }}", unit_of_measurement: "V", suggested_display_precision: 1 }),
        },
        {
            type: "sensor",
            config: __assign(__assign({}, baseConfig), { enabled_by_default: false, device_class: "current", state_class: "measurement", state_topic: "~/state", name: "Current", unique_id: info.id + "_current", value_template: "{{ value_json.current }}", unit_of_measurement: "A", suggested_display_precision: 1 }),
        },
        {
            type: "sensor",
            config: __assign(__assign({}, baseConfig), { enabled_by_default: false, device_class: "frequency", state_class: "measurement", state_topic: "~/state", name: "Frequency", unique_id: info.id + "_frequency", value_template: "{{ value_json.freq }}", unit_of_measurement: "Hz" }),
        },
        {
            type: "sensor",
            config: __assign(__assign({}, baseConfig), { enabled_by_default: false, device_class: "energy", state_class: "total_increasing", state_topic: "~/state", name: "Energy", unique_id: info.id + "_aenergy", value_template: "{{ value_json.aenergy.total }}", unit_of_measurement: "Wh", suggested_display_precision: 1 }),
        },
        {
            type: "sensor",
            config: __assign(__assign({}, baseConfig), { enabled_by_default: false, device_class: "power_factor", state_class: "measurement", state_topic: "~/state/cover:0", name: "Energy", unique_id: info.id + "_power_factor", value_template: "{{ value_json.pf * 100 }}", unit_of_measurement: "%", suggested_display_precision: 0 }),
        },
        {
            type: "binary_sensor",
            config: __assign(__assign({}, baseConfig), { device_class: "problem", name: "Optimistic position", entity_category: "diagnostic", unique_id: info.id + "_position_lost", state_topic: "~/state", value_template: "{{ value_json.recover_position_required }}", payload_on: true, payload_off: false }),
        },
    ];
    for (var _i = 0, entities_1 = entities; _i < entities_1.length; _i++) {
        var _a = entities_1[_i], type = _a.type, config = _a.config;
        tryMqttPublish("homeassistant/".concat(type, "/").concat(config.unique_id, "/config"), config, true);
    }
}
// 10m * 60s * 1000ms
var TEN_MINUTES_MS = 600000;
var info = Shelly.getDeviceInfo();
var coverConfig = Shelly.getComponentConfig("cover:0");
var topic_prefix = Shelly.getComponentConfig("mqtt").topic_prefix;
var CoverPosition = /** @class */ (function () {
    function CoverPosition(positioningResolutionPercent) {
        this.positioningResolutionPercent = positioningResolutionPercent;
    }
    CoverPosition.prototype.setClosed = function () {
        this.current = 0;
    };
    CoverPosition.prototype.setOpened = function () {
        this.current = 100;
    };
    CoverPosition.prototype.isClosed = function () {
        return this.current !== undefined && this.current <= 0;
    };
    CoverPosition.prototype.isOpen = function () {
        return this.current !== undefined && this.current >= 0;
    };
    CoverPosition.prototype.isMoreOpenThan = function (otherPosition) {
        var _a;
        var isMoreOpen = ((_a = this.current) !== null && _a !== void 0 ? _a : 0) >= otherPosition;
        console.log("is ".concat(this.current, " more open than ").concat(otherPosition, " ? ").concat(isMoreOpen));
        return isMoreOpen;
    };
    CoverPosition.prototype.isMoreClosedThan = function (otherPosition) {
        var _a;
        var isMoreClosed = ((_a = this.current) !== null && _a !== void 0 ? _a : 100) <= otherPosition;
        console.log("is ".concat(this.current, " more closed than ").concat(otherPosition, " ? ").concat(isMoreClosed));
        return isMoreClosed;
    };
    CoverPosition.prototype.getDirectionTo = function (requestedPosition) {
        if (this.current === undefined) {
            return undefined;
        }
        var delta = this.current - requestedPosition;
        return delta < 0 ? "open" : "close";
    };
    CoverPosition.prototype.openOneStep = function () {
        if (this.current === undefined) {
            console.log("Unable to change current virtual position because it is currently unknown");
            return;
        }
        var newPosition = this.current + this.positioningResolutionPercent;
        this.current = Math.min(100, newPosition);
    };
    CoverPosition.prototype.closeOneStep = function () {
        if (this.current === undefined) {
            console.log("Unable to change current virtual position because it is currently unknown");
            return;
        }
        var newPosition = this.current - this.positioningResolutionPercent;
        this.current = Math.max(0, newPosition);
    };
    CoverPosition.prototype.toString = function () {
        var _a, _b;
        return (_b = (_a = this.current) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : "";
    };
    return CoverPosition;
}());
var CoverPositionController = /** @class */ (function () {
    function CoverPositionController(coverConfig) {
        this.positioningResolutionPercent = 5;
        this.position = new CoverPosition(this.positioningResolutionPercent);
        var closeTime = duration({ seconds: coverConfig.maxtime_close * 0.85 });
        this.closingStepDuration = duration({
            millis: (closeTime.asMillis / 100) * this.positioningResolutionPercent,
        });
        var openTime = duration({ seconds: coverConfig.maxtime_open * 0.85 });
        this.openingStepDuration = duration({
            seconds: coverConfig.maxtime_close * 0.85,
        });
    }
    CoverPositionController.prototype.publishPosition = function () {
        if (this.position.current !== undefined) {
            tryMqttPublish("".concat(topic_prefix, "/position"), this.position.current);
        }
    };
    CoverPositionController.prototype.publishState = function () {
        var _a;
        var _b = Shelly.getComponentStatus("sys"), restart_required = _b.restart_required, unixtime = _b.unixtime, uptime = _b.uptime, available_updates = _b.available_updates;
        var wifi = Shelly.getComponentStatus("wifi");
        var _c = Shelly.getComponentStatus("cover:0"), current_pos = _c.current_pos, target_pos = _c.target_pos, state = __rest(_c, ["current_pos", "target_pos"]);
        tryMqttPublish("".concat(topic_prefix, "/state"), __assign(__assign({}, state), { wifi: wifi, restart_required: restart_required, recover_position_required: this.position === undefined, uptime: uptime, lastRestart: unixtime - uptime, availableUpdate: (_a = available_updates.stable) === null || _a === void 0 ? void 0 : _a.version }));
        this.publishPosition();
    };
    CoverPositionController.prototype.startClosingPosition = function () {
        var _this = this;
        var _a;
        console.log("Start position update from ".concat(this.position, "% to 0%"));
        (_a = this.positioningRepeatHandle) === null || _a === void 0 ? void 0 : _a.cancel();
        this.positioningRepeatHandle = repeat({
            every: this.closingStepDuration,
            action: function () {
                _this.position.closeOneStep();
                _this.publishPosition();
            },
            until: function () { return _this.position.isClosed(); },
        });
    };
    CoverPositionController.prototype.startOpeningPosition = function () {
        var _this = this;
        var _a;
        console.log("Start position update from ".concat(this.position, "% to 100%"));
        (_a = this.positioningRepeatHandle) === null || _a === void 0 ? void 0 : _a.cancel();
        this.positioningRepeatHandle = repeat({
            every: this.openingStepDuration,
            action: function () {
                _this.position.openOneStep();
                _this.publishPosition();
            },
            until: function () { return _this.position.isOpen(); },
        });
    };
    CoverPositionController.prototype.moveToPosition = function (requestedPosition) {
        var _this = this;
        var _a;
        if (this.position === undefined) {
            console.log("Ignoring positioning request because current position is unknown");
            return;
        }
        (_a = this.positionReachedTrackerHandle) === null || _a === void 0 ? void 0 : _a.cancel();
        var direction = this.position.getDirectionTo(requestedPosition);
        console.log("Position request to ".concat(direction, " from ").concat(this.position, " to ").concat(requestedPosition));
        switch (direction) {
            case "open":
                Shelly.call("Cover.Open", { id: 0 });
                break;
            case "close":
                Shelly.call("Cover.Close", { id: 0 });
                break;
            default:
                console.log("Can't define direction to move from ".concat(this.position.current, " to ").concat(requestedPosition));
        }
        this.positionReachedTrackerHandle = repeat({
            every: duration({ millis: 500 }),
            action: function () { },
            until: function () {
                if (direction === "close" &&
                    _this.position.isMoreClosedThan(requestedPosition)) {
                    Shelly.call("Cover.Stop", { id: 0 });
                    return true;
                }
                if (direction === "open" &&
                    _this.position.isMoreOpenThan(requestedPosition)) {
                    Shelly.call("Cover.Stop", { id: 0 });
                    return true;
                }
                return false;
            },
            timeout: duration({
                seconds: this.closingStepDuration.asSeconds +
                    this.openingStepDuration.asSeconds,
            }),
        });
    };
    CoverPositionController.prototype.stopPosition = function () {
        var _a;
        (_a = this.positioningRepeatHandle) === null || _a === void 0 ? void 0 : _a.cancel();
    };
    CoverPositionController.prototype.markClosed = function () {
        var _a;
        (_a = this.positioningRepeatHandle) === null || _a === void 0 ? void 0 : _a.cancel();
        this.position.setClosed();
        this.publishPosition();
    };
    CoverPositionController.prototype.markOpened = function () {
        var _a;
        (_a = this.positioningRepeatHandle) === null || _a === void 0 ? void 0 : _a.cancel();
        this.position.setOpened();
        this.publishPosition();
    };
    return CoverPositionController;
}());
var cover = new CoverPositionController(coverConfig);
// Handle shelly events:
// - virtual switches up/down/stop
// - physical switches up/down/stop
Shelly.addEventHandler(function (event) {
    if (!isCoverEvent(event.info)) {
        console.log("unsupported event", JSON.stringify(event));
        return;
    }
    var _a = event.info, state = _a.event, source = _a.source;
    cover.publishState();
    switch (state) {
        case "closing":
            cover.startClosingPosition();
            break;
        case "closed":
            cover.markClosed();
            break;
        case "opening":
            cover.startOpeningPosition();
            break;
        case "open":
            cover.stopPosition();
            if (source === "timeout") {
                cover.markOpened();
            }
            break;
        case "stopped":
            cover.stopPosition();
            break;
        default:
            console.log("Unknown state", JSON.stringify(event));
    }
});
// Start the script.
// - acquire MQTT connection
// - subscribe HA "online" event
// - announce sensors
// - listen for position requests
function start() {
    withExponentialBackoffRetry("Subscribing to HomeAssistant status", function () {
        if (!MQTT.isConnected()) {
            console.log("MQTT is not ready");
            return false;
        }
        MQTT.subscribe("homeassistant/status", function (topic, payload) {
            console.log("HomeAssistant is ".concat(payload));
            if (payload.toLowerCase() === "online") {
                announce();
            }
        });
        MQTT.subscribe("".concat(topic_prefix, "/position/set"), function (topic, payload) {
            var position = parseInt(payload);
            if (0 <= position && position <= 100) {
                console.log("Received position request: ".concat(position));
                cover.moveToPosition(position);
            }
            else {
                console.log("Ignoring invalid position request: ".concat(payload));
            }
        });
        announce();
        cover.publishState();
        return true;
    });
}
MQTT.setDisconnectHandler(function () {
    console.log("MQTT connection lost");
    start();
});
start();
// periodically announce device configuration
Timer.set(duration({ hours: 20, minutes: 20 }).asMillis, true, announce);
// periodically announce device state
Timer.set(duration({ minutes: 10 }).asMillis, true, function () {
    cover.publishState();
});
function isCoverEvent(info) {
    return "component" in info && info.component === "cover:0";
}
