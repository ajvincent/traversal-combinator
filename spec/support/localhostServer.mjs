import express from 'express';
import path from 'path';
import process from 'process';

// https://www.npmjs.com/package/express-ipfilter
import { IpFilter } from 'express-ipfilter';

export default class HttpServer {
  #port;
  #express;
  #server;

  constructor(port) {
    this.#port = port;

    this.#express = express();
    this.#express.use(IpFilter(['::ffff:127.0.0.1', "::1"], { mode: 'allow', log: false }));

    this.#express.use("/",         this.#getStatic("docs"));
    this.#express.use("/fixtures", this.#getStatic("spec/http-fixtures"));
  }

  #getStatic(pathToDir) {
    return express.static(path.join(process.cwd(), pathToDir));
  }

  start() {
    this.#server = this.#express.listen(this.#port);
  }

  close() {
    return new Promise(resolve => this.#server.close(resolve));
  }
}
