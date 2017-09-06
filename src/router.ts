import * as fs from 'fs';

import * as etcd from 'promise-etcd';
import * as Rx from 'rxjs';
import * as yargs from 'yargs';

function createEtcd(argv: any): etcd.Etcd {
    const cfg = etcd.Config.start([
        '--etcd-cluster-id', argv.etcdClusterId,
        '--etcd-app-id', argv.etcdAppId,
        '--etcd-url', argv.etcdUrl,
    ]);
    const etc = etcd.Etcd.create(cfg);
    return etc;
}

export function cli(args: string[]): Rx.Observable<string> {
    return Rx.Observable.create((observer: Rx.Observer<string>) => {
        let y = yargs.usage('$0 <cmd> [args]');
        y.option('logLevel', {
            describe: 'logLevel ala winston',
            default: 'info'
        });
        y.command('version', 'Show router\'s version', {}, (argv: any) => {
            observer.next('1.0');
            observer.complete();
        });
        y.command('start', 'Starts router', {
            'etcd-cluster-id': {
                default: 'ClusterWorld'
            },
            'etcd-app-id': {
                default: 'HelloWorld'
            },
            'etcd-url': {
                default: 'http://localhost:2379'
            },
        }, (argv: any) => {
            const etc = createEtcd(argv);
            etc.connect().then(() => {
                observer.next('Router started');
                observer.complete();
            }).catch((error) => {
                observer.error(error);
                observer.complete();
            });
        });

        y.command('add-endpoint', 'Adds new endpoint to the catalog', {
            'etcd-cluster-id': {
                default: 'ClusterWorld'
            },
            'etcd-app-id': {
                default: 'HelloWorld'
            },
            'etcd-url': {
                default: 'http://localhost:2379'
            },

            'service-name': {
                description: 'Name of the service'
            },
            'node-name': {
                description: 'Name of the node'
            },
            'ip': {
                description: 'IP address of the endpoint'
            },
            'port': {
                description: 'Port of the endpoint'
            },
            'tls-cert': {
                description: 'Path to TLS certificate file'
            },
            'tls-chain': {
                description: 'Path to TLS chain file'
            },
            'tls-key': {
                description: 'Path to TLS key file'
            }
        }, (argv) => {
            const etc = createEtcd(argv);
            const tlsCert = fs.readFileSync(argv.tlsCert, 'utf8');
            const tlsChain = fs.readFileSync(argv.tlsChain, 'utf8');
            const tlsKey = fs.readFileSync(argv.tlsKey, 'utf8');
            etc.connect().then(() => {
                etc.mkdir(`${argv.serviceName}`).then(() => {
                    etc.mkdir(`${argv.serviceName}/nodes`).then(() => {
                        etc.setJson(`${argv.serviceName}/nodes/${argv.nodeName}`, {
                            ip: argv.ip,
                            port: argv.port,
                        }).then(() => {
                            etc.mkdir(`${argv.serviceName}/tls`).then(() => {
                                etc.setRaw(`${argv.serviceName}/tls/cert`, tlsCert).then(() => {
                                    etc.setRaw(`${argv.serviceName}/tls/chain`, tlsChain).then(() => {
                                        etc.setRaw(`${argv.serviceName}/tls/key`, tlsKey).then(() => {
                                            observer.next('Endpoint was added');
                                            observer.complete();
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            }).catch((error) => {
                observer.error(error);
                observer.complete();
            });

        });

        y.command('list-endpoints', 'Show the list of endpoints', {
            'etcd-cluster-id': {
                default: 'ClusterWorld'
            },
            'etcd-app-id': {
                default: 'HelloWorld'
            },
            'etcd-url': {
                default: 'http://localhost:2379'
            },
        }, (argv) => {
            const etc = createEtcd(argv);
            etc.list('', {recursive: true}).then((val) => {
                observer.next(JSON.stringify(val.value));
                observer.complete();
            });
        });

        y.command('delete-endpoint', 'Delete endpoint from the list', {
            'etcd-cluster-id': {
                default: 'ClusterWorld'
            },
            'etcd-app-id': {
                default: 'HelloWorld'
            },
            'etcd-url': {
                default: 'http://localhost:2379'
            },
            'service-name': {
                description: 'Name of the service'
            },
        }, (argv) => {
            const etc = createEtcd(argv);
            etc.rmdir(argv.serviceName, {recursive: true}).then((resp) => {
                observer.next('Node was removed');
                observer.complete();
            });
        });
        y.help().parse(args);
    });
}
