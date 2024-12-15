import std::io;
import std::os::process;
import std::collections;

def StrList = List(<String>);

struct Command {
  StrList parts;
  SubProcess proc;
}

fn Command* Command.new_init(&self, String cmd) {
  self.parts.new_init();
  self.parts.push(cmd);
  return self;
}

fn Command* Command.arg(&self, String arg) {
  self.parts.push(arg);
  return self;
}

macro Command* Command.args(&self, ...) {
  $for (var $i = 0; $i < $vacount; ++$i)
    self.arg($vaconst[$i]);
  $endfor
  return self;
}

fn bool Command.clear(&self) {
  if (try self.proc.is_running()) {
    io::eprintn("[ERROR] Attempting to clear command that's currently running");
    return false;
  }
  self.parts.clear();
  return true;
}

fn void! Command.run_async(&self) {
  SubProcessOptions options = {
    /* .combined_stdout_stderr = true, */
    .inherit_environment = true,
  };
  io::print("[CMD]");
  foreach (String arg : self.parts) {
    if (arg.contains(" ")) {
      io::printf(" '%s'", arg);
    } else {
      io::printf(" %s", arg);
    }
  }
  io::print("\n");
  self.proc = process::create(self.parts.to_tarray(), options)!;
}

fn CInt! Command.run_sync(&self) {
  self.run_async()!;
  return self.proc.join();
}

fn void Command.print_stdout(&self) {
  const usz BUF_SIZE = 1024;
  char *buf = mem::new_array(char, BUF_SIZE);
  defer free(buf);
  for (;;) {
    usz! len = self.proc.read_stdout(buf, BUF_SIZE);
    if (catch excuse = len) {
      io::eprintfn("[ERROR] Failed to read from stdout: %s", excuse);
      return;
    }
    if (len == 0) {
      break;
    }
    io::print(buf[0:len]);
  };
}


fn void Command.print_stderr(&self) {
  const usz BUF_SIZE = 1024;
  char *buf = mem::new_array(char, BUF_SIZE);
  defer free(buf);
  for (;;) {
    usz! len = self.proc.read_stderr(buf, BUF_SIZE);
    if (catch excuse = len) {
      io::eprintfn("[ERROR] Failed to read from stderr: %s", excuse);
      return;
    }
    if (len == 0) {
      break;
    }
    io::print(buf[0:len]);
  };
}

fn void Command.print_output(&self) {
  self.print_stderr();
  self.print_stdout();
}

const String WASM_OUTPATH = "./build/stuff";

fn bool build_wasm() {
  Command cmd = {};
  defer cmd.parts.free();
  cmd.new_init("c3c")
    .arg("compile")
    .args("-D", "PLATFORM_WEB")
    .arg("--reloc=none")
    .args("--target", "wasm32")
    .args("-O5", "-g0", "--link-libc=no", "--no-entry")
    .arg("--trust=full")
    .args("-o", WASM_OUTPATH)
    .args("-z", "--export-table")
    .arg("c3-src/main.c3")
    .arg("c3-src/ext.c3");

  CInt! code = cmd.run_sync();
  if (catch excuse = code) {
    io::eprintfn("[ERROR] %s", excuse);
    return false;
  }
  cmd.print_output();
  if (code != 0) {
    io::eprintn("[ERROR] Failed to build wasm");
    return false;
  }
  io::printfn("[INFO] Built wasm: %s.wasm", WASM_OUTPATH);
  return true;
}

fn bool build_mainjs() {
  Command cmd = {};
  defer cmd.parts.free();
  cmd.new_init("bunx").arg("tsc");

  CInt! code = cmd.run_sync();
  if (catch excuse = code) {
    io::eprintfn("[ERROR] %s", excuse);
    return false;
  }
  cmd.print_output();
  if (code != 0) {
    io::eprintn("[ERROR] Typscript transpilation failed");
    return false;
  }
  io::printn("[INFO] tsc main.ts -> main.js");
  return true;
}

fn int main() {
  
  if (!build_wasm()) return 1;
  if (!build_mainjs()) return 1;
  
  return 0;
}
