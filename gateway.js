import express from 'express'
import colors from 'colors'
import dotenv from 'dotenv'
import cors from 'cors'
import morgan from 'morgan'
import proxy from 'express-http-proxy';
import path from "path";

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import slowDown from "express-slow-down";

dotenv.config();

const USER_SERVICE_URL = process.env.USER_SERVICE_URL_PROD || process.env.USER_SERVICE_URL

const POST_SERVICE_URL = process.env.POST_SERVICE_URL_PROD || process.env.POST_SERVICE_URL

const ORIGIN_URL = process.env.ORIGIN_URL_PROD || process.env.ORIGIN_URL

const app = express()
app.use(express.json())

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: "Too many requests"
});
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 500,
  delayMs: () => 0
});

app.use(morgan('dev'));
app.use(helmet());
app.use(limiter);
app.use(speedLimiter);
app.use(compression());


app.use(cors({
  origin: ORIGIN_URL,
  credentials: true
}));

app.get('/', (req, res) => {
  res.send('Gateway is running.');
})

const skipJsonRoutes = ['/auth/upload', '/post/upload'];

app.use((req, res, next) => {
  if (skipJsonRoutes.some(route => req.originalUrl.startsWith(route))) {
    return next();
  }
  express.json()(req, res, next);
});

app.use('/auth', proxy(USER_SERVICE_URL, {
  proxyReqPathResolver: req => `/api/auth${req.url}`,
  proxyErrorHandler: (err, res, next) => {
    res.status(500).send('Proxy error');
  },
  userResHeaderDecorator: (headers, userReq, userRes) => {
    headers['Access-Control-Allow-Origin'] = ORIGIN_URL;
    headers['Access-Control-Allow-Credentials'] = 'true';
    return headers;
  }
}));

app.use('/post', proxy(POST_SERVICE_URL, {
  proxyReqPathResolver: req => `/api/post${req.url}`,
  proxyErrorHandler: (err, res, next) => {
    res.status(500).send('Proxy error');
  },
  userResHeaderDecorator: (headers, userReq, userRes) => {
    headers['Access-Control-Allow-Origin'] = ORIGIN_URL;
    headers['Access-Control-Allow-Credentials'] = 'true';
    return headers;
  }
}));

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Gateway is running on port ${PORT}`.bgYellow)
})
