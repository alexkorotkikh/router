import * as http from 'http';

import * as Rx from 'rxjs';
import * as winston from 'winston';

import { EndPoint } from './endpoint';

interface EndpointServers {
  endpoint: EndPoint;
  servers: http.Server[];
}

export class ServerManager {
  private logger: winston.LoggerInstance;
  private endpointsConfig: Map<string, EndpointServers>;

  constructor(logger: winston.LoggerInstance) {
    this.logger = logger;
    this.endpointsConfig = new Map;
    this.handler = this.handler.bind(this);
  }

  updateEndpoints(endpoints: EndPoint[]): Rx.Observable<string> {
    return Rx.Observable.create((observer: Rx.Observer<string>) => {
      endpoints.forEach(endpoint => {
        if (this.endpointsConfig.has(endpoint.name)) {
          const outdated = this.endpointsConfig.get(endpoint.name).endpoint;
          if (!endpoint.equals(outdated)) {
            this.shutDownEndpoint(outdated, observer);
            this.spinUpEndpoint(endpoint, observer);
          }
        } else {
          this.spinUpEndpoint(endpoint, observer);
        }
      });
      observer.next('OK');
    });
  }

  private shutDownEndpoint(endpoint: EndPoint, observer: Rx.Observer<string>) {
    const servers = this.endpointsConfig.get(endpoint.name).servers;
    servers.forEach(server => {
      if (server.listening) {
        const address = server.address();
        server.close(() => {
          observer.next(`${address.address}:${address.port} : server closed`)
        });
      }
    });
    this.endpointsConfig.delete(endpoint.name)
  }

  private spinUpEndpoint(endpoint: EndPoint, observer: Rx.Observer<string>) {
    const servers: http.Server[] = [];
    endpoint.nodes.forEach(node => {
      node.listBinds().forEach(bind => {
        const server = http.createServer(this.handler);
        server.listen(bind.port, bind.ip.to_s(), (err: any) => {
          if (err) {
            observer.error(err);
          }
          observer.next(`server is listening on ${bind.ip.to_s()}:${bind.port}`);
        });
        servers.push(server);
      });
    });
    this.endpointsConfig.set(endpoint.name, { endpoint: endpoint, servers: servers })
  }

  private handler(req: http.IncomingMessage, res: http.ServerResponse) {
    this.logger.info(`${req.method} ${req.url}`);
    res.end()
  }
}