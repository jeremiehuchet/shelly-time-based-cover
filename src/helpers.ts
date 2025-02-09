String.prototype.concat = function (...strings: string[]): string {
  let s = this as string;
  for (const other of strings) {
    s += other;
  }
  return s;
};

function normalizeMac(originalMac: string) {
  let mac = "";
  for (let i = 0; i < originalMac.length; i = i + 2) {
    if (mac.length !== 0) {
      mac += ":";
    }
    mac += originalMac.substring(i, i + 2);
  }
  return mac;
}

const INITIAL_DELAY_MS = 1000;
function withExponentialBackoffRetry(
  title: string,
  callback: () => boolean,
  initialDelayMs: number = INITIAL_DELAY_MS
) {
  console.log(title);
  let success = false;
  try {
    success = callback();
  } catch (e) {
    console.log("ERROR", e);
  }
  if (!success) {
    const nextDelayMs =
      initialDelayMs > TEN_MINUTES_MS ? initialDelayMs * 2 : INITIAL_DELAY_MS;
    console.log('Will retry "' + title + '" in ' + nextDelayMs / 60 + "s");
    Timer.set(initialDelayMs, false, () =>
      withExponentialBackoffRetry(title, callback, nextDelayMs)
    );
  }
}

type Duration = {
  asMillis: number;
  asSeconds: number;
};

function duration({
  millis,
  seconds,
  minutes,
  hours,
}: {
  millis?: number;
  seconds?: number;
  minutes?: number;
  hours?: number;
}): Duration {
  const timestamp =
    (millis ?? 0) +
    (seconds ?? 0) * 1000 +
    (minutes ?? 0) * 1000 * 60 +
    (hours ?? 0) * 1000 * 60 * 60;
  return {
    asMillis: timestamp,
    asSeconds: timestamp / 1000,
  };
}

type Timeout = {
  isExpired(): boolean;
};

function startTimeout(duration: Duration): Timeout {
  const startInstant = Shelly.getComponentStatus("sys").uptime;
  const expirationInstant = startInstant + duration.asSeconds;
  return {
    isExpired: () => {
      const currentInstant = Shelly.getComponentStatus("sys").uptime;
      return expirationInstant < currentInstant;
    },
  };
}

type RepeatHandle = {
  cancel(): void;
};

function repeat({
  every,
  action,
  until,
  timeout = duration({ minutes: 1 }),
}: {
  every: Duration;
  action: () => void;
  until: () => boolean;
  timeout?: Duration;
}): RepeatHandle {
  const timeoutClock = startTimeout(timeout);
  let handle: ShellyTimerHandle | undefined = undefined;
  const execute = () => {
    if (!until() && !timeoutClock.isExpired()) {
      action();
      handle = Timer.set(every.asMillis, false, execute);
    }
  };
  execute();
  return {
    cancel: () => {
      if (handle) {
        Timer.clear(handle);
      }
    },
  };
}
