// 10m * 60s * 1000ms
const TEN_MINUTES_MS = 600000;

const info = Shelly.getDeviceInfo();
const coverConfig = Shelly.getComponentConfig("cover:0");
const { topic_prefix } = Shelly.getComponentConfig("mqtt");

class CoverPosition {
  public current: number | undefined;

  constructor(private positioningResolutionPercent: number) {}

  setClosed() {
    this.current = 0;
  }

  setOpened() {
    this.current = 100;
  }

  isClosed(): boolean {
    return this.current !== undefined && this.current <= 0;
  }

  isOpen(): boolean {
    return this.current !== undefined && this.current >= 0;
  }

  isMoreOpenThan(otherPosition: number): boolean {
    const isMoreOpen = (this.current ?? 0) >= otherPosition;
    console.log(
      `is ${this.current} more open than ${otherPosition} ? ${isMoreOpen}`
    );
    return isMoreOpen;
  }

  isMoreClosedThan(otherPosition: number): boolean {
    const isMoreClosed = (this.current ?? 100) <= otherPosition;
    console.log(
      `is ${this.current} more closed than ${otherPosition} ? ${isMoreClosed}`
    );
    return isMoreClosed;
  }

  getDirectionTo(requestedPosition: number): "open" | "close" | undefined {
    if (this.current === undefined) {
      return undefined;
    }
    const delta = this.current - requestedPosition;
    return delta < 0 ? "open" : "close";
  }

  openOneStep() {
    if (this.current === undefined) {
      console.log(
        "Unable to change current virtual position because it is currently unknown"
      );
      return;
    }
    const newPosition = this.current + this.positioningResolutionPercent;
    this.current = Math.min(100, newPosition);
  }

  closeOneStep() {
    if (this.current === undefined) {
      console.log(
        "Unable to change current virtual position because it is currently unknown"
      );
      return;
    }
    const newPosition = this.current - this.positioningResolutionPercent;
    this.current = Math.max(0, newPosition);
  }

  public toString(): string {
    return this.current?.toString() ?? "";
  }
}

class CoverPositionController {
  private position: CoverPosition;
  private positioningRepeatHandle: RepeatHandle | undefined;
  private positionReachedTrackerHandle: RepeatHandle | undefined;

  private positioningResolutionPercent = 5;
  private closingStepDuration: Duration;
  private openingStepDuration: Duration;

  constructor(coverConfig: { maxtime_close: number; maxtime_open: number }) {
    this.position = new CoverPosition(this.positioningResolutionPercent);
    const closeTime = duration({ seconds: coverConfig.maxtime_close * 0.85 });
    this.closingStepDuration = duration({
      millis: (closeTime.asMillis / 100) * this.positioningResolutionPercent,
    });
    const openTime = duration({ seconds: coverConfig.maxtime_open * 0.85 });
    this.openingStepDuration = duration({
      seconds: coverConfig.maxtime_close * 0.85,
    });
  }

  private publishPosition() {
    if (this.position.current !== undefined) {
      tryMqttPublish(`${topic_prefix}/position`, this.position.current);
    }
  }

  publishState() {
    const { restart_required, unixtime, uptime, available_updates } =
      Shelly.getComponentStatus("sys");
    const wifi = Shelly.getComponentStatus("wifi");
    const { current_pos, target_pos, ...state } =
      Shelly.getComponentStatus("cover:0");
    tryMqttPublish(`${topic_prefix}/state`, {
      ...state,
      wifi,
      restart_required,
      recover_position_required: this.position === undefined,
      uptime,
      lastRestart: unixtime - uptime,
      availableUpdate: available_updates.stable?.version,
    });
    this.publishPosition();
  }

  startClosingPosition() {
    console.log(`Start position update from ${this.position}% to 0%`);
    this.positioningRepeatHandle?.cancel();
    this.positioningRepeatHandle = repeat({
      every: this.closingStepDuration,
      action: () => {
        this.position.closeOneStep();
        this.publishPosition();
      },
      until: () => this.position.isClosed(),
    });
  }

  startOpeningPosition() {
    console.log(`Start position update from ${this.position}% to 100%`);
    this.positioningRepeatHandle?.cancel();
    this.positioningRepeatHandle = repeat({
      every: this.openingStepDuration,
      action: () => {
        this.position.openOneStep();
        this.publishPosition();
      },
      until: () => this.position.isOpen(),
    });
  }

  moveToPosition(requestedPosition: number) {
    if (this.position === undefined) {
      console.log(
        "Ignoring positioning request because current position is unknown"
      );
      return;
    }
    this.positionReachedTrackerHandle?.cancel();

    const direction = this.position.getDirectionTo(requestedPosition);
    console.log(
      `Position request to ${direction} from ${this.position} to ${requestedPosition}`
    );
    switch (direction) {
      case "open":
        Shelly.call("Cover.Open", { id: 0 });
        break;
      case "close":
        Shelly.call("Cover.Close", { id: 0 });
        break;
      default:
        console.log(
          `Can't define direction to move from ${this.position.current} to ${requestedPosition}`
        );
    }

    this.positionReachedTrackerHandle = repeat({
      every: duration({ millis: 500 }),
      action: () => {},
      until: () => {
        if (
          direction === "close" &&
          this.position.isMoreClosedThan(requestedPosition)
        ) {
          Shelly.call("Cover.Stop", { id: 0 });
          return true;
        }
        if (
          direction === "open" &&
          this.position.isMoreOpenThan(requestedPosition)
        ) {
          Shelly.call("Cover.Stop", { id: 0 });
          return true;
        }
        return false;
      },
      timeout: duration({
        seconds:
          this.closingStepDuration.asSeconds +
          this.openingStepDuration.asSeconds,
      }),
    });
  }

  stopPosition() {
    this.positioningRepeatHandle?.cancel();
  }

  markClosed() {
    this.positioningRepeatHandle?.cancel();
    this.position.setClosed();
    this.publishPosition();
  }

  markOpened() {
    this.positioningRepeatHandle?.cancel();
    this.position.setOpened();
    this.publishPosition();
  }
}

const cover = new CoverPositionController(coverConfig);

// Handle shelly events:
// - virtual switches up/down/stop
// - physical switches up/down/stop
Shelly.addEventHandler((event: ShellyEvent) => {
  if (!isCoverEvent(event.info)) {
    console.log("unsupported event", JSON.stringify(event));
    return;
  }
  const { event: state, source } = event.info;
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
  withExponentialBackoffRetry("Subscribing to HomeAssistant status", () => {
    if (!MQTT.isConnected()) {
      console.log("MQTT is not ready");
      return false;
    }
    MQTT.subscribe("homeassistant/status", (topic, payload) => {
      console.log(`HomeAssistant is ${payload}`);
      if (payload.toLowerCase() === "online") {
        announce();
      }
    });
    MQTT.subscribe(`${topic_prefix}/position/set`, (topic, payload) => {
      const position = parseInt(payload);
      if (0 <= position && position <= 100) {
        console.log(`Received position request: ${position}`);
        cover.moveToPosition(position);
      } else {
        console.log(`Ignoring invalid position request: ${payload}`);
      }
    });
    announce();
    cover.publishState();
    return true;
  });
}

MQTT.setDisconnectHandler(() => {
  console.log("MQTT connection lost");
  start();
});

start();

// periodically announce device configuration
Timer.set(duration({ hours: 20, minutes: 20 }).asMillis, true, announce);

// periodically announce device state
Timer.set(duration({ minutes: 10 }).asMillis, true, () => {
  cover.publishState();
});
