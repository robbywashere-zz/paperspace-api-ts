import PaperspaceApi, { ResponseWithBody } from "./api";
import { ResponseError } from "superagent";
import { EventEmitter } from "events";

export type ThenArg<T> = T extends Promise<infer U>
  ? U
  : T extends (...args: any[]) => Promise<infer U>
  ? U
  : T;

function chomp(str: string) {
  return str.endsWith("\r") ? str.slice(0, -1) : str;
}

export class PaperspaceClient extends PaperspaceApi {
  static JobArtifactsGet() {}

  static PollEndpoint<T>(fn: () => T, interval: number) {
    const emitter = new PollEmitter<ThenArg<T>>();
    let broken = false;
    emitter.on("end", () => {
      broken = true;
      emitter.removeAllListeners();
    });
    (async function() {
      while (!broken) {
        try {
          const res = await fn();
          emitter.emit("data", res);
        } catch (e) {
          if (e.status) emitter.emit("pipeError", e);
          else emitter.emit("error", e);
        }
        await new Promise(rs => setTimeout(rs, interval));
      }
    })();
    return emitter;
  }

  static PollLogFn(
    fn: (
      { line, ...args }: { line?: number; args?: any[] }
    ) => Promise<ResponseWithBody<{ line: number; message: string }[]>>,
    pollInterval?: number
  ) {
    const logEmitter = new LogEmitter();
    let broken = false;
    logEmitter.on("end", () => {
      broken = true;
      logEmitter.removeAllListeners();
    });
    (async function PollLogs() {
      let lastLine = 0;
      const PSEOF = "PSEOF";
      while (!broken) {
        try {
          const { body: lines = [] } = await fn({
            line: lastLine || undefined
          });
          for (let { line, message } of lines) {
            lastLine = line;
            if (message === PSEOF) throw PSEOF;
            logEmitter.emit("message", { line, message: chomp(message) });
          }
        } catch (e) {
          if (e.status) logEmitter.emit("pipeError", e);
          else if (e === PSEOF) break;
          else throw e;
        }
        await new Promise(rs => setTimeout(rs, pollInterval));
      }
      logEmitter.emit("end");
    })().catch(e => {
      logEmitter.emit("error", e);
      logEmitter.emit("end");
    });

    return logEmitter;
  }

  static async WaitFor<T>(
    fn: () => T,
    check: (response: ThenArg<T>) => boolean,
    timeout?: { delay?: number; retry?: number }
  ) {
    const to = { ...timeout, delay: 3000, retry: 10 };
    await (async function wait(count = 0): Promise<void> {
      if (to.retry && to.retry >= count)
        new WaitTimeout(
          `::: PaperspaceApi#WaitFor - timeout ${to.delay * count}ms`
        );
      try {
        let res = await fn();
        if (check(res as ThenArg<T>)) return;
      } catch (e) {
        if (!e.status) throw e; //unknown error occured
      }
      await new Promise(rs => setTimeout(rs, to.delay));
      return wait(count++);
    })();
  }
}

export class WaitTimeout extends Error {}

export interface PollEmitter<T> {
  on(type: "pipeError", fn: (e: ResponseError) => void): this;
  on(type: "error", fn: (e: Error) => void): this;
  on(type: "end", fn: () => void): this;
  on(type: "data", fn: (body: T) => void): this;
  close(): void;
}

export class PollEmitter<T> extends EventEmitter {
  close() {
    this.emit("end");
  }
}

export interface LogEmitter {
  on(type: "pipeError", fn: (e: ResponseError) => void): this;
  on(type: "error", fn: (e: Error) => void): this;
  on(type: "end", fn: (...args: any[]) => void): this;
  on(
    type: "message",
    fn: ({ line, message }: { line?: number; message?: string }) => void
  ): this;
  close(): void;
}

export class LogEmitter extends EventEmitter {
  close() {
    this.emit("end");
  }
}
