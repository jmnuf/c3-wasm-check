# c3-wasm

Just a little usage of [c3](https://c3-lang.org/) v.0.6.3 in WebAssembly to try it out.
Did implement a bit of a proof of concept on JS promises with wasm, but not good for general usage.

To build the project you need c3c in your path and bun for running `bunx tsc`.
If you don't want to use bun you can switch the bld.c3 file to use tsc from wherever you prefer.

Build project:
```bash
c3c compile-run -o build/bld bld.c3
```

File `bld.c3` actually defines how to build the main c3 code we transform into wasm and also just as nicely calls `bunx tsc`.
You will then see `./build/stuff.wasm` and `./main.js`

This project was created using `bun init` in bun v1.1.34. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
