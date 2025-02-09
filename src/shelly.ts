// Globals
type ShellyScript = {
  id: string;
};

type ShellyContext = {
  getDeviceInfo(): ShellyDeviceInfo;
  getComponentConfig(name: "mqtt"): ShellyMqttConfig;
  getComponentConfig(name: "cover:0"): ShellyCoverConfig;
  getComponentStatus(name: "sys"): ShellySystemStatus;
  getComponentStatus(name: "wifi"): ShellyWifiStatus;
  getComponentStatus(name: "cover:0"): ShellyCoverStatus;
  addEventHandler(eventHandler: (event: ShellyEvent) => void): void;
  call(method: "Cover.Open", params: { id: 0 }): void;
  call(method: "Cover.Stop", params: { id: 0 }): void;
  call(method: "Cover.Close", params: { id: 0 }): void;
};

type ShellyDeviceInfo = {
  name: string;
  id: string;
  mac: string;
  slot: number;
  key: string;
  batch: string;
  fw_sbits: string;
  model: string;
  gen: number;
  fw_id: string;
  ver: string;
  app: string;
  auth_en: boolean;
  auth_domain: string;
};

type ShellyCoverStatus = {
  id: number;
  source: string;
  state: "open" | "closed" | "opening" | "closing" | "stopped" | "calibrating";
  apower: number;
  voltage: number;
  current: number;
  pf: number;
  freq: number;
  aenergy: {
    total: number;
    by_minute: number[];
    minute_ts: number;
  };
  current_pos?: number | null;
  target_pos?: number | null;
  move_timeout?: number;
  move_started_at?: number;
  pos_control: boolean;
  last_direction: "open" | "close" | null;
  temperature: {
    tC: number;
    tF: number;
  };
  errors?: string[];
};

type ShellyMqttConfig = {
  enable: boolean;
  server: string | null;
  client_id: string;
  user: string | null;
  pass: string | null;
  ssl_ca: string | null;
  topic_prefix: string;
  rpc_ntf: boolean;
  status_ntf: boolean;
  use_client_cert: boolean;
  enable_rpc: boolean;
  enable_control: boolean;
};

type ShellyCoverConfig = {
  id: number;
  name: string;
  in_mode?: "single" | "dual" | "detached";
  initial_state: "open" | "closed" | "stopped";
  power_limit: number;
  voltage_limit: number;
  undervoltage_limit: number;
  current_limit: number;
  motor: {
    idle_power_thr: number;
    idle_confirm_period: number;
  };
  maxtime_open: number;
  maxtime_close: number;
  swap_inputs?: boolean;
  invert_directions: boolean;
  obstruction_detection?: {
    enable: boolean;
    direction: "open" | "close" | "both";
    action: "stop" | "reverse";
    power_thr: number;
    holdoff: number;
  };
  safety_switch?: {
    enable: boolean;
    direction: "open" | "close" | "both";
    action: "stop" | "reverse" | "pause";
    allowed_move: "reverse" | null;
  };
};

type ShellySystemStatus = {
  mac: string;
  restart_required: boolean;
  time: string;
  unixtime: number;
  uptime: number;
  ram_size: number;
  ram_free: number;
  fs_size: number;
  fs_free: number;
  cfg_rev: number;
  kvs_rev: number;
  schedule_rev: number;
  webhook_rev: number;
  available_updates: {
    stable?: {
      version: string;
      build_id: string;
    };
    beta?: {
      version: string;
      build_id: string;
    };
  };
};

type ShellyWifiStatus = {
  sta_ip: string | null;
  status: string;
  ssid: string | null;
  rssi: number;
  ap_client_count: number;
};

type ShellyMqtt = {
  isConnected(): boolean;
  setDisconnectHandler(handler: () => void): void;
  publish(topic: string, payload: any, qos: 0 | 1 | 2, retain: boolean): void;
  subscribe(
    topicPattern: string,
    messageHandler: (topic: string, payload: any) => void
  ): void;
};

type ShellyTimer = {
  set(
    delayInMs: number,
    repeat: boolean,
    callback: () => void
  ): ShellyTimerHandle;
  clear(handle: ShellyTimerHandle): void;
};
type ShellyTimerHandle = {};

// Events
type ShellyComponent = "cover:0";
type ShellyEventName = "closing" | "closed" | "opening" | "open" | "stopped";
type ShellyEventSource = "WS_in" | "switch" | "timeout";
type ShellyCoverEventInfo = {
  component: "cover:0";
  id: number;
  event: ShellyEventName;
  source: ShellyEventSource;
  ts: number;
};
function isCoverEvent(info: any): info is ShellyCoverEventInfo {
  return "component" in info && info.component === "cover:0";
}

type ShellyEvent = { info: ShellyCoverEventInfo | {} };
