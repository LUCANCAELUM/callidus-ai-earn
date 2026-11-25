import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const publicLatency = new Trend('public_stats_latency');

export const options = {
  stages: [
    { duration: '1m', target: 100 },     // Warm-up: 100 VUs
    { duration: '2m', target: 1000 },    // Ramp: 1,000 concurrent users
    { duration: '3m', target: 10000 },   // Scale target phase: 10,000 VUs
    { duration: '3m', target: 50000 },   // High concurrency spike: 50,000 VUs
    { duration: '2m', target: 100000 },  // Peak 100,000 simultaneous target validation
    { duration: '1m', target: 0 },       // Graceful cool-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1200'],
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, { 'health is 200': (r) => r.status === 200 }) || errorRate.add(1);

  const statsRes = http.get(`${BASE_URL}/api/public/stats`);
  publicLatency.add(statsRes.timings.duration);
  check(statsRes, { 'stats returned': (r) => r.status === 200 }) || errorRate.add(1);

  const tasksRes = http.get(`${BASE_URL}/api/tasks`);
  check(tasksRes, { 'tasks listed': (r) => r.status === 200 }) || errorRate.add(1);

  sleep(1);
}
