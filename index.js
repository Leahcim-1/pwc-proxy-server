const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const fs = require('fs');
const winston = require('winston');


if (!fs.existsSync('auth-list.json')) throw Error("No auth files");

const AUTH = JSON.parse(fs.readFileSync('auth-list.json', "utf8"));

const app = express()
const port = 3000

const logger = new (winston.Logger)({
    transports: [
        new (winston.transports.File)({
            name: 'error-file',
            filename: 'error.log',
            level: 'error'
        }),
        new (winston.transports.File)({ filename: 'proxy.log' })
    ]
});

/**
 * Logger Injection
 * @param {*} provider 
 * @returns 
 */
function logProvider() {
    const myCustomProvider = {
        log: logger.log,
        debug: logger.debug,
        info: logger.info,
        warn: logger.warn,
        error: logger.error,
    };
    return myCustomProvider;
}


app.use((req, _, next) => {
    const { headers } = req;
    if (!headers['proxy-authorization']) return;
    if (!headers['proxy-authorization'].includes('Basic ')) return;
    const authCode = headers['proxy-authorization'].split('Basic ')[1];
    if (!authCode) return;
    const user = Buffer.from(authCode, 'base64').toString('utf8');
    if (!AUTH.AuthList.includes(user)) return
    next();
})

const proxyReqHandler = (proxyReq, req, res, target) => {
    logger.info(`dest-url: ${req.url}`)
}

const proxyErrorHandler = (err, req, res, target) => {
    logger.error(err);
    res.writeHead(500, {
      'Content-Type': 'text/plain',
    });
    res.end('Something went wrong. And we are reporting a custom error message.');
  }


const options = {
    router: function (req) {
        return req.url;
    },
    logProvider,
    onProxyReq: proxyReqHandler,
    onError: proxyErrorHandler,
}

const proxy = createProxyMiddleware(options)

app.use('/', proxy)

app.listen(port, () => {
    console.log(`PWC Proxy app listening on port ${port}`)
})