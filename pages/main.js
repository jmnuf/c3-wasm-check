const PI = Math.PI;
const TAU = PI * 2;
function make_environment(env) {
    return new Proxy(env, {
        get(_target, prop, _receiver) {
            if (env[prop] !== undefined) {
                return env[prop].bind(env);
            }
            return (...args) => {
                throw new Error(`NOT IMPLEMENTED: ${String(prop)} ${args}`);
            };
        }
    });
}
// function cstrlen(mem: Uint8Array, ptr: number) {
//   let len = 0;
//   while (mem[ptr] != 0) {
//     len++;
//     ptr++;
//   }
//   return len;
// }
// function cstr_by_ptr(memory: WebAssembly.Memory, ptr: number) {
//   const buffer = memory.buffer;
//   const mem = new Uint8Array(buffer);
//   const len = cstrlen(mem, ptr);
//   const bytes = new Uint8Array(buffer, ptr, len);
//   return new TextDecoder().decode(bytes);
// }
// function min(x: number, y: number, ...rest: number[]) {
//   let min = Math.min(x, y);
//   for (const v of rest) {
//     min = Math.min(min, v);
//   }
//   return min;
// }
const LEVEL = Object.freeze({
    INFO: 0,
    WARN: 1,
    ERROR: 2,
    LOG: 3,
});
class Logger {
    #info_buf;
    #err_buf;
    #warn_buf;
    #system;
    constructor(sys) {
        this.#info_buf = "";
        this.#err_buf = "";
        this.#warn_buf = "";
        this.#system = sys;
        this.log = this.log.bind(this);
        this.info = this.info.bind(this);
        this.warn = this.warn.bind(this);
        this.error = this.error.bind(this);
    }
    log(lvl, str) {
        switch (lvl) {
            case LEVEL.INFO:
                this.info(str);
                break;
            case LEVEL.WARN:
                this.warn(str);
                break;
            case LEVEL.ERROR:
                this.error(str);
                break;
            default:
                console.error("[Logger.ERROR] Unknown log level provided: " + String(lvl));
                console.log("[Logger.INFO] Message:", str);
                break;
        }
    }
    info(str) {
        if (str.includes("\n")) {
            const strIdx = str.lastIndexOf("\n");
            const subStr = str.substring(0, strIdx);
            const message = this.#info_buf + subStr;
            console.log(`[${this.#system}.INFO]`, `${message}`);
            this.#info_buf = str.substring(strIdx + 1);
        }
        else {
            this.#info_buf += str;
        }
    }
    error(str) {
        if (str.includes("\n")) {
            const strIdx = str.lastIndexOf("\n");
            const subStr = str.substring(0, strIdx);
            const message = this.#err_buf + subStr;
            console.error(`[${this.#system}.ERROR]`, `${message}`);
            this.#err_buf = str.substring(strIdx + 1);
        }
        else {
            this.#err_buf += str;
        }
    }
    warn(str) {
        if (str.includes("\n")) {
            const strIdx = str.lastIndexOf("\n");
            const subStr = str.substring(0, strIdx);
            const message = this.#warn_buf + subStr;
            console.warn(`[${this.#system}.WARN]`, `${message}`);
            this.#warn_buf = str.substring(strIdx + 1);
        }
        else {
            this.#warn_buf += str;
        }
    }
}
(async function main() {
    const wasmLogger = new Logger("WASM");
    const jsLogger = new Logger("JS");
    const info = (message) => jsLogger.log(LEVEL.INFO, message + "\n");
    // const warn = (message: string) => jsLogger.log(LEVEL.WARN, message + "\n");
    const error = (message) => jsLogger.log(LEVEL.ERROR, message + "\n");
    const cnv = document.querySelector("canvas#cnv");
    if (!(cnv instanceof HTMLCanvasElement))
        throw new Error("Canvas not found");
    info("Found canvas with id: cnv");
    cnv.width = 800;
    cnv.height = 600;
    const ctx = cnv.getContext("2d");
    if (!ctx)
        throw new Error("Canvas was unable to generate Context2D");
    info("Loaded Context2D from canvas");
    const promiseCbs = new Map();
    let renderer = undefined;
    const result = await promiseResult(WebAssembly.instantiateStreaming(fetch("./build/stuff.wasm"), {
        env: make_environment({
            log(log_level, message_ptr, message_len) {
                const message = readStringPtr(message_ptr, message_len);
                wasmLogger.log(log_level, message);
            },
            logln(log_level, message_ptr, message_len) {
                const message = readStringPtr(message_ptr, message_len);
                wasmLogger.log(log_level, message + "\n");
            },
            run(fnPointer) {
                useTableFn(fnPointer, (result) => {
                    if (result.ok) {
                        result.value();
                    }
                    else {
                        console.error(result.error);
                    }
                });
            },
            randf() {
                return Math.random();
            },
            randi() {
                return Math.floor(Math.random() * Number.MAX_VALUE);
            },
            do_fetch(url_ptr, url_len) {
                console.log(`[JS.INFO] do_fetch called with`, arguments);
                const { buffer } = memory();
                const { alloc_promise, alloc_char_arr, alloc_result, free } = exports();
                const url = readStringPtr(url_ptr, url_len);
                info("Fetch requested by wasm with url: " + url);
                const promisePtr = alloc_promise();
                promiseCbs.set(promisePtr, []);
                info(`Allocated WASM promise struct at: ${promisePtr}`);
                fetch(url)
                    .then(res => res.text().then(txt => ({ res, txt })))
                    .then((value) => {
                    return { ok: true, value };
                })
                    .catch((error) => {
                    return { ok: false, error };
                })
                    .then((fetchResult) => {
                    const wasmPromise = new Uint8Array(buffer, promisePtr, 1);
                    wasmPromise[0] = 1;
                    // Bitoff - Property     - Type  - bytesLen - bitsLen
                    //  0     - Result.ok    - bool  - 1 bytes  -   8 bits
                    //  8     - Result.value - void* - 4 bytes  -  32 bits
                    // 40     - Result.error - char* - 4 bytes  -  32 bits
                    const resultPtr = alloc_result();
                    let errorPtr = 0;
                    let valuePtr = 0;
                    const resBuf = new Uint8Array(buffer, resultPtr, 3);
                    if (!fetchResult.ok) {
                        resBuf[0] = 0;
                        // Generate error string
                        {
                            const errorMsg = fetchResult.error.message;
                            errorPtr = alloc_char_arr(errorMsg.length);
                            const errBuf = new Uint8Array(buffer, errorPtr, errorMsg.length + 1);
                            for (let i = 0; i < errorMsg.length; ++i) {
                                const code = errorMsg.charCodeAt(i);
                                errBuf[i] = code;
                            }
                            errBuf[errorMsg.length] = 0;
                        }
                        const buf = new Uint32Array(buffer, resultPtr + 8, 2);
                        buf[0] = 0; // Null pointer on value
                        buf[1] = errorPtr; // Our string's pointer
                    }
                    else {
                        const { txt: respText, res: _resp } = fetchResult.value;
                        info(`Received response text with a length of ${respText.length}`);
                        resBuf[0] = 1; // ok: true
                        // Transform response string
                        {
                            valuePtr = alloc_char_arr(respText.length);
                            const valBuf = new Uint8Array(buffer, valuePtr, respText.length + 1);
                            for (let i = 0; i < respText.length; ++i) {
                                const code = respText.charCodeAt(i);
                                valBuf[i] = code;
                            }
                            valBuf[respText.length] = 0;
                        }
                        const buf = new Uint32Array(buffer, resultPtr + 8, 2);
                        buf[0] = valuePtr;
                        buf[1] = 0; // Null pointer on error
                    }
                    const callbacks = promiseCbs.get(promisePtr) ?? [];
                    promiseCbs.delete(promisePtr);
                    for (const cb of callbacks) {
                        cb(resultPtr);
                    }
                    setTimeout(() => {
                        free(promisePtr);
                        free(resultPtr);
                        if (errorPtr) {
                            free(errorPtr);
                        }
                        if (valuePtr) {
                            free(valuePtr);
                        }
                    }, 1_000);
                });
                return promisePtr;
            },
            on_promise_done(promisePtr, fnPtr) {
                const cbs = promiseCbs.get(promisePtr);
                // Promise is done and should never call onto JS if so
                if (!cbs) {
                    error(`Attempting to add callback for completed Promise. If promise is done c3 should handle it`);
                    return 0;
                }
                useTableFn(fnPtr, (result) => {
                    if (!result.ok) {
                        error(`Failed to get function from pointer: ${result.error}`);
                        return;
                    }
                    cbs.push(result.value);
                });
            },
            set_renderer(fn_ptr) {
                useTableFn(fn_ptr, (result) => {
                    if (!result.ok) {
                        error(`Failed to get function from pointer: ${result.error}`);
                        return;
                    }
                    renderer = result.value;
                });
            },
            clear_screen() {
                ctx.clearRect(0, 0, cnv.width, cnv.height);
            },
            draw_line(x1, y1, x2, y2) {
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
            },
            fill_circle(x, y, r) {
                ctx.beginPath();
                ctx.ellipse(x, y, r, r, 0, 0, TAU);
                ctx.fill();
            },
            fill_rect(x, y, w, h) {
                ctx.fillRect(x, y, w, h);
            },
            fill_screen(clr_ptr) {
                const color = readColorPtr(clr_ptr);
                const curSt = ctx.fillStyle;
                ctx.fillStyle = `rgb(${color.r} ${color.g} ${color.b} / ${color.a})`;
                ctx.fillRect(0, 0, cnv.width, cnv.height);
                ctx.fillStyle = curSt;
            },
            screen_width() {
                return cnv.width;
            },
            screen_height() {
                return cnv.height;
            },
            set_fill_color(clr_ptr) {
                const color = readColorPtr(clr_ptr);
                ctx.fillStyle = `rgb(${color.r} ${color.g} ${color.b} / ${color.a})`;
            },
            set_stroke_color(clr_ptr) {
                const color = readColorPtr(clr_ptr);
                ctx.strokeStyle = `rgb(${color.r} ${color.g} ${color.b} / ${color.a})`;
            },
        }),
    }));
    if (!result.ok) {
        console.error(result.error);
        return;
    }
    info("Loaded WASM into memory");
    const wasm = result.value;
    console.log("wasm ::", wasm);
    const exports = () => wasm.instance.exports;
    const useExports = (cb) => cb(exports());
    const memory = () => wasm.instance.exports.memory;
    const useMemory = (cb) => cb(memory());
    const readStringPtr = (ptr, len) => useMemory(({ buffer }) => {
        const bytes = new Uint8Array(buffer, ptr, len);
        return new TextDecoder().decode(bytes);
    });
    const readColorPtr = (ptr) => useMemory(({ buffer }) => {
        const mem = new Uint8Array(buffer, ptr, 4);
        const [r, g, b] = mem;
        const a = mem[3] / 100;
        return { r, g, b, a };
    });
    // Function Table, not sure if I'll need it
    const fnTable = () => wasm.instance.exports.__indirect_function_table;
    const useTableFn = (ptr, cb) => {
        try {
            const table = fnTable();
            const fn = table.get(ptr);
            if (!fn)
                throw new Error("Pointer doesn't point to a function");
            return cb({ ok: true, value: fn });
        }
        catch (err) {
            return cb({ ok: false, error: err });
        }
    };
    try {
        useExports(({ _initialize: init }) => init());
        info(`Memory has been initialized`);
    }
    catch (err) {
        error(`Failed to initialize memory: ${err}`);
        return;
    }
    const shouldContinue = useExports(({ main }) => {
        try {
            const code = main();
            if (code != 0) {
                error("Assuming failure of prelude since main() returned non-zero code: " + String(code));
                return false;
            }
            return true;
        }
        catch (err) {
            error(`Failed to run main: ${err}`);
            return false;
        }
    });
    if (!shouldContinue) {
        return;
    }
    if (!renderer) {
        error("No renderer was set in main() call. Remember to call set_renderer");
        return;
    }
    let prevTime = 0;
    const frame = (time) => {
        const dt = (time - prevTime) / 1000;
        prevTime = time;
        renderer(dt);
        requestAnimationFrame(frame);
    };
    requestAnimationFrame((time) => {
        prevTime = time;
        requestAnimationFrame(frame);
        info("Started animation loop");
    });
})();
async function promiseResult(promise) {
    return promise.then(value => {
        return { ok: true, value };
    }).catch(error => {
        return { ok: false, error };
    });
}
export {};
