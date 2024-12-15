module ext;

enum Log : char {
  INFO,
  WARN,
  ERROR,
}

struct Rgba {
  char r;
  char g;
  char b;
  char a;
}

struct Result {
  bool ok;
  void* value;
  char[] error;
}

def PromiseCb = fn void(Result*);
struct Promise {
  bool completed;
  // Result result;
}
fn Promise *Promise.then(&self, PromiseCb cb) {
  return js_on_promise_done(self, cb);
}


def VoidFn = fn void();
def StepFn = fn void(float);

extern fn void wasm_log(Log log_level, char *message, uint len) @extern("log");
extern fn void wasm_logln(Log log_level, char *message, uint len) @extern("logln");
extern fn char[]  js_gen_string(char[] *buffer) @extern("gen_string");
extern fn float   js_randf() @extern("randf");
extern fn int     js_randi() @extern("randi");
extern fn Promise *js_fetch(char *url, uint url_len) @extern("do_fetch") @private;
extern fn Promise *js_on_promise_done(Promise *promise, PromiseCb cb) @extern("on_promise_done") @private;

fn Result *alloc_result() @private @export("alloc_result") {
  return mem::new(Result);
}

fn Promise *fetch(String url) {
  return js_fetch(url, url.len);
}

fn Promise *alloc_promise() @private @export("alloc_promise") {
  return mem::new(Promise);
}

fn char[] alloc_char_arr(usz len) @private @export("alloc_char_arr") {
  return mem::new_array(char, len);
}
fn void mem_free(void *ptr) @private @export("free") {
  mem::free(ptr);
}

extern fn void clear_screen() @extern("clear_screen");
extern fn uint get_screen_width() @extern("screen_width");
extern fn uint get_screen_height() @extern("screen_height");

extern fn void set_fill_color(Rgba color) @extern("set_fill_color");
extern fn void fill_screen(Rgba color) @extern("fill_screen");
extern fn void fill_rect(int x, int y, int w, int h) @extern("fill_rect");
extern fn void fill_circle(int x, int y, int r) @extern("fill_circle");

extern fn void set_stroke_color(Rgba color) @extern("set_stroke_color");
extern fn void draw_line(int x1, int y1, int x2, int y2) @extern("draw_line");

extern fn void run(VoidFn) @extern("run");
extern fn void set_renderer(StepFn) @extern("set_renderer");

fn void print(Log lvl, String fmt, args...) {
  if (args.len > 0) {
    String message = string::new_format(fmt, ...args);

    if (message.len > uint.max) {
      wasm_log(Log.WARN, "Attempting to write message that's too long", (uint)63);
    }
    wasm_log(lvl, message, (uint)message.len);

    message.free();
  } else {
    if (fmt.len > uint.max) {
      wasm_log(Log.WARN, "Attempting to write message that's too long", (uint)63);
    }
    wasm_log(lvl, fmt, (uint)fmt.len);
  }
}

fn void println(Log lvl, String fmt, args...) {
  if (args.len > 0) {
    String message = string::new_format(fmt, ...args);

    if (message.len > uint.max) {
      wasm_logln(Log.WARN, "Attempting to write message that's too long", (uint)63);
    }
    wasm_logln(lvl, message, (uint)message.len);

    message.free();
  } else {
    if (fmt.len > uint.max) {
      wasm_logln(Log.WARN, "Attempting to write message that's too long", (uint)63);
    }
    wasm_logln(lvl, fmt, (uint)fmt.len);
  }
}
