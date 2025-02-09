function tryMqttPublish(
  topic: string,
  payload: object | string | number | boolean,
  retain = false
) {
  const payloadString = JSON.stringify(payload);
  //console.log(`publishing ${topic}: ${payloadString.substring(0, 30)}`);
  MQTT.publish(topic, payloadString, 0, retain);
}

type MqttEntityConfig = {
  type: "sensor" | "binary_sensor" | "cover";
  config: Record<string, any> & {
    unique_id: string;
  };
};

function announce() {
  const { sta_ip: ipAddr } = Shelly.getComponentStatus("wifi");

  const baseConfig = {
    "~": topic_prefix,
    origin: {
      name: "shelly-ha-mqtt-auto-discovery",
      sw_version: "0.1",
      support_url:
        "https://gist.github.com/jeremiehuchet/84e8dc96573e37200c2ab3bd4e013729",
    },
    device: {
      configuration_url: ipAddr ? `http://${ipAddr}` : undefined,
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

  const entities: MqttEntityConfig[] = [
    {
      type: "cover",
      config: {
        ...baseConfig,
        has_entity_name: true,
        command_topic: "~/command/cover:0",
        device_class: "shutter",
        payload_close: "close",
        payload_open: "open",
        payload_stop: "stop",
        position_closed: 0,
        position_open: 100,
        position_topic: "~/position",
        set_position_topic: "~/position/set",
        state_closed: "closed",
        state_closing: "closing",
        state_open: "open",
        state_opening: "opening",
        state_stopped: "stopped",
        state_topic: "~/state",
        unique_id: info.id,
        value_template: "{{ value_json.state }}",
      },
    },

    {
      type: "sensor",
      config: {
        ...baseConfig,
        device_class: "temperature",
        name: "Device temperature",
        entity_category: "diagnostic",
        unique_id: info.id + "_device_temp",
        state_class: "measurement",
        state_topic: "~/state",
        value_template: "{{ value_json.temperature.tC }}",
        unit_of_measurement: "°C",
      },
    },

    {
      type: "binary_sensor",
      config: {
        ...baseConfig,
        device_class: "problem",
        name: "Restart required",
        entity_category: "diagnostic",
        unique_id: info.id + "_restart_required",
        state_topic: "~/state",
        value_template: "{{ value_json.restart_required }}",
        payload_on: true,
        payload_off: false,
      },
    },

    {
      type: "sensor",
      config: {
        ...baseConfig,
        device_class: "date",
        name: "Last restart",
        entity_category: "diagnostic",
        unique_id: info.id + "_last_restart",
        state_class: "measurement",
        state_topic: "~/state",
        value_template: "{{ value_json.lastRestart | timestamp_local }}",
      },
    },

    {
      type: "sensor",
      config: {
        ...baseConfig,
        entity_category: "diagnostic",
        device_class: "signal_strength",
        state_topic: "~/state",
        name: "Wifi signal strength",
        unique_id: info.id + "_wifi_rssi",
        state_class: "measurement",
        value_template: "{{ value_json.wifi.rssi }}",
        unit_of_measurement: "dBm",
      },
    },

    {
      type: "sensor",
      config: {
        ...baseConfig,
        entity_category: "diagnostic",
        state_topic: "~/state",
        name: "Wifi SSID",
        unique_id: info.id + "_wifi_ssid",
        icon: "mdi:wifi-settings",
        value_template: "{{ value_json.wifi.ssid }}",
      },
    },

    {
      type: "sensor",
      config: {
        ...baseConfig,
        entity_category: "diagnostic",
        state_topic: "~/state",
        name: "Wifi IP address",
        unique_id: info.id + "_wifi_ip",
        icon: "mdi:ip-outline",
        value_template: "{{ value_json.wifi.sta_ip }}",
      },
    },

    {
      type: "sensor",
      config: {
        ...baseConfig,
        enabled_by_default: false,
        device_class: "power",
        state_class: "measurement",
        state_topic: "~/state",
        name: "Power",
        unique_id: info.id + "_apower",
        value_template: "{{ value_json.apower }}",
        unit_of_measurement: "W",
        suggested_display_precision: 1,
      },
    },

    {
      type: "sensor",
      config: {
        ...baseConfig,
        enabled_by_default: false,
        device_class: "voltage",
        state_class: "measurement",
        state_topic: "~/state",
        name: "Voltage",
        unique_id: info.id + "_voltage",
        value_template: "{{ value_json.voltage }}",
        unit_of_measurement: "V",
        suggested_display_precision: 1,
      },
    },

    {
      type: "sensor",
      config: {
        ...baseConfig,
        enabled_by_default: false,
        device_class: "current",
        state_class: "measurement",
        state_topic: "~/state",
        name: "Current",
        unique_id: info.id + "_current",
        value_template: "{{ value_json.current }}",
        unit_of_measurement: "A",
        suggested_display_precision: 1,
      },
    },

    {
      type: "sensor",
      config: {
        ...baseConfig,
        enabled_by_default: false,
        device_class: "frequency",
        state_class: "measurement",
        state_topic: "~/state",
        name: "Frequency",
        unique_id: info.id + "_frequency",
        value_template: "{{ value_json.freq }}",
        unit_of_measurement: "Hz",
      },
    },

    {
      type: "sensor",
      config: {
        ...baseConfig,
        enabled_by_default: false,
        device_class: "energy",
        state_class: "total_increasing",
        state_topic: "~/state",
        name: "Energy",
        unique_id: info.id + "_aenergy",
        value_template: "{{ value_json.aenergy.total }}",
        unit_of_measurement: "Wh",
        suggested_display_precision: 1,
      },
    },

    {
      type: "sensor",
      config: {
        ...baseConfig,
        enabled_by_default: false,
        device_class: "power_factor",
        state_class: "measurement",
        state_topic: "~/state/cover:0",
        name: "Energy",
        unique_id: info.id + "_power_factor",
        value_template: "{{ value_json.pf * 100 }}",
        unit_of_measurement: "%",
        suggested_display_precision: 0,
      },
    },

    {
      type: "binary_sensor",
      config: {
        ...baseConfig,
        device_class: "problem",
        name: "Optimistic position",
        entity_category: "diagnostic",
        unique_id: info.id + "_position_lost",
        state_topic: "~/state",
        value_template: "{{ value_json.recover_position_required }}",
        payload_on: true,
        payload_off: false,
      },
    },
  ];

  for (const { type, config } of entities) {
    tryMqttPublish(`homeassistant/${type}/${config.unique_id}/config`, config, true);
  }
}
