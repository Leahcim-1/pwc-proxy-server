const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const http = require('http');

const fs = require('fs');
const winston = require('winston');
const dotenv = require('dotenv')

const ENV = dotenv.config({
    path: './.env'
}).parsed

const agent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 60000,
    maxSockets: 100,
})

const whitelist = [
    'dns.weixin.qq.com',
]

if (!fs.existsSync('auth-list.json')) throw Error("No auth files");

const AUTH = JSON.parse(fs.readFileSync('auth-list.json', "utf8"));

const app = express()
const host = ENV.RUN_ENV === 'prod' ? '0.0.0.0' : '127.0.0.1'
const port =ENV.RUN_ENV === 'prod' ? 9527 : 3000

const logger = new (winston.Logger)({
    transports: [
        new (winston.transports.File)({
            name: 'error-file',
            filename: 'error.log',
            level: 'error'
        }),
        new (winston.transports.File)({
            name: 'warn-file',
            filename: 'warn.log',
            level: 'warn'
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
    if (whitelist.includes(headers.host)) {
        next();
        return;
    }

    if (!headers['proxy-authorization']) {
        console.log(req.headers)
        logger.warn(`Illegal Attempted: ${req.originalUrl}`)
        console.warn(`Illegal Attempted: ${req.originalUrl}`)
        return
    };
    if (!headers['proxy-authorization'].includes('Basic ')) return;
    const authCode = headers['proxy-authorization'].split('Basic ')[1];
    if (!authCode) return;
    const user = Buffer.from(authCode, 'base64').toString('utf8');
    if (!AUTH.AuthList.includes(user)) return
    next();
})

const proxyReqHandler = (proxyReq, req, res, target) => {
    logger.info(`dest-url: ${req.url}`)
    console.log(`dest-url: ${req.url}`)
}

const proxyErrorHandler = (err, req, res, target) => {
    logger.error(err);
    console.log(err)
    res.writeHead(500, {
      'Content-Type': 'text/plain',
    });
    res.end('Something went wrong. And we are reporting a custom error message.');
}

const options = {
    router: function (req) {
        return req.originalUrl;
    },
    logProvider,
    // selfHandleResponse: true, // res.end() will be called internally by responseInterceptor()
    // onProxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
    //     res.setHeader('Connection', 'close'); // Set a new header and value
    //     return responseBuffer
    // }),
    agent,
    onProxyReq: proxyReqHandler,
    onError: proxyErrorHandler,
}

const proxy = createProxyMiddleware(options)

app.use('/', proxy)

app.listen(port, host, () => {
    console.log(`PWC Proxy app listening on ${host}:${port}`)
})