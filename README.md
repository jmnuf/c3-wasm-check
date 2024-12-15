# c3-wasm

Just a little usage of [c3](https://c3-lang.org/) v.0.6.3 in WebAssembly to try it out.
Did implement a bit of a proof of concept on JS promises with wasm, but not good for general usage.

Build project:
```bash
c3c compile-run -o build/bld bld.c3
```
File `bld.c3` actually defines how to build the main c3 code we transform into wasm and also just as nicely calls `bunx tsc`.
You will then see `./build/stuff.wasm` and `./main.js`


To install dependencies:

```bash
bun install
```

To run:

```bash
bunx http-server
```

This project was created using `bun init` in bun v1.1.34. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
