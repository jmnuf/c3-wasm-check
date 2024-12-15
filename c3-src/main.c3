import ext;

def println = ext::println;
def print = ext::print;

struct Ball {
  float[<2>] pos;
  float[<2>] vel;
  int rad;
  Rgba color;
}
fn void Ball.render(&self) {
  ext::set_fill_color(self.color);
  ext::fill_circle((int) self.pos.x, (int) self.pos.y, self.rad);
}
fn void Ball.update(&self, float dt) {
  self.pos.x += self.vel.x * dt;
  self.pos.y += self.vel.y * dt;
}

fn void Ball.check_screen_collision(&self) {
  int  bx = (int)self.pos.x;
  int  by = (int)self.pos.y;
  uint sw = ext::get_screen_width();
  uint sh = ext::get_screen_height();
  if (bx >= sw - self.rad || bx <= self.rad) {
    self.vel.x *= -1;
    if (bx < self.rad) self.pos.x = self.rad + 0.5f;
    if (bx > sw + self.rad) self.pos.x = (float)(sw - self.rad) - 0.5f;
  }
  if (by >= sh - self.rad || by <= self.rad) {
    self.vel.y *= -1;
    if (by < self.rad) self.pos.y = self.rad + 0.5f;
    if (by > sh + self.rad) self.pos.y = (float)(sh - self.rad) - 0.5f;
  }
}

Ball[5] balls;

Promise *fetch_promise;

fn int main() @export("main") {
  // println(Log.INFO, "Hello, World!");
  // println(Log.WARN, "This is a warning");
  // print(Log.ERROR, "Couldn't load asset");
  // print(Log.ERROR, " \"urmom\", ");
  // println(Log.ERROR, "too big!");


  uint sw = ext::get_screen_width();
  int spacing = sw / (balls.len + 1);
  for (usz i = 0; i < balls.len; ++i) {
    Ball *ball = &balls[i];
    int x = spacing + spacing * i;
    ball.pos = { x, 100.0f };
    if (i > balls.len / 2) {
      ball.vel = { 100, 300 };
    } else if (i < balls.len / 2) {
      ball.vel = { -100, 300 };
    } else {
      ball.vel = { 0, 300 };
    }
    ball.color = { 50+(50*(char)i), 51, 120, 100 };
    ball.rad = 50;
  }

  // ext::run(fn () => println(Log.INFO, "Sum of 34 and 35 is %d", add(34, 35)));

  fetch_promise = ext::fetch("https://echo.free.beeceptor.com?from=wasm");
  fetch_promise.then(&fetch_completed);

  println(Log.INFO, "Got promise at ptr: %d", (int)fetch_promise);

  ext::set_renderer(&render);
  
  return 0;
}

fn void fetch_completed(Result *res) {
  println(Log.INFO, "Received fetch result");
  if (!res.ok) {
    println(Log.ERROR, (String) res.error);
    return;
  }
  println(Log.INFO, "Fetch was successful");
  ZString response = (ZString)(char*)res.value;
  println(Log.INFO, "Received response text with a length of %d", response.len());
}


fn void render(float dt) {
  ext::clear_screen();
  ext::fill_screen({ 0xA8, 0xA8, 0xA8, 100 });

  usz sw = ext::get_screen_width();
  usz sh = ext::get_screen_height();
  int cell_size = 100;
  int cell_cols = sw / cell_size;
  int cell_rows = sh / cell_size;

  for (int x = 0; x < cell_cols; ++x) {
    for (int y = 0; y < cell_rows; ++y) {
      int flat_idx = y * cell_rows + (x % cell_cols);
      if (y % 2 == 0) {
        if (flat_idx % 2 == 0) {
          ext::set_fill_color({ 51, 51, 51, 100 });
        } else {
          ext::set_fill_color({ 51, 51, 51, 50 });
        }
      } else {
        if (flat_idx % 2 != 0) {
          ext::set_fill_color({ 51, 51, 51, 100 });
        } else {
          ext::set_fill_color({ 51, 51, 51, 50 });
        }
      }
      ext::fill_rect(x * cell_size, y * cell_size, cell_size, cell_size);
    }
  }

  
  foreach(&ball: balls) {
    ball.update(dt);
    ball.check_screen_collision();
    ball.render();
  }
}

fn int add(int x, int y) {
  return x + y;
}
