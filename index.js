const fs = require('fs');
const async = require('async');
const _ = require('lodash');
const Benchmark = require('benchmark');
const beauty = require('beautify-benchmark');

const NpmPromise = require('promise');
const NpmBluebirdPromise = require("bluebird");
const RSVP = require('rsvp');
const Q = require('q');

const benchmarks = {
  'async.forever by linked objects with resolve': (count) => {
    return {
      fn(defer) {
        const start = { listener: resolve => setTimeout(resolve, 0), next: null };
        let last = start;
        _.times(count, () => {
          const next = { listener: resolve => setTimeout(resolve, 0), next: null };
          last.next = next;
          last = next;
        });
        let pointer = start;
        async.forever(
          (next) => {
            pointer.listener(() => {
              pointer = pointer.next;
              if (pointer) next();
              else next(true);
            });
          },
          () => defer.resolve(),
        );
      },
      defer: true,
    };
  },
  'async.series': (count) => {
    return {
      fn(defer) {
        const tasks = _.times(count, () => resolve => setTimeout(resolve, 0));
        async.series(tasks, () => defer.resolve());
      },
      defer: true,
    };
  },
  'then promise then promise': (count) => {
    return {
      async fn(defer) {
        const root = new Promise(resolve => resolve());
        let pointer = root;
        for (let i = 0; i < count; i++) {
          pointer = pointer.then(() => new Promise(resolve => setTimeout(resolve, 0)));
        }
        pointer.then(() => defer.resolve());
      },
      defer: true,
    };
  },
  'async await': (count) => {
    return {
      async fn(defer) {
        const tasks = _.times(count, () => resolve => setTimeout(resolve, 0));
        for (let i = 0; i < count; i++) {
          await new Promise(tasks[i]);
        }
        defer.resolve();
      },
      defer: true,
    };
  },
  'recursive setTimeout': (count) => {
    return {
      async fn(defer) {
        let i = 0;
        const onTimeout = () => {
          i++;
          if (i < count) {
            method();
          } else {
            defer.resolve();
          }
        };
        const method = () => setTimeout(onTimeout, 0);
        method();
      },
      defer: true,
    };
  },
};

const createSuite = (benchmarks, count) => {
  const suite = new Benchmark.Suite();
  for (let t in benchmarks) suite.add(t, benchmarks[t](count));
  return suite;
};

const createSuites = (benchmarks) => {
  return {
    '10 items': createSuite(benchmarks, 10),
    '100 items': createSuite(benchmarks, 100),
    '250 items': createSuite(benchmarks, 250),
    '500 items': createSuite(benchmarks, 500),
    '1000 items': createSuite(benchmarks, 1000),
    '5000 items': createSuite(benchmarks, 5000),
    '10000 items': createSuite(benchmarks, 10000),
  };
};

const suites = createSuites(benchmarks);

const launch = (suites) => {
  async.eachSeries(
    _.keys(suites),
    (suiteName, next) => {
      console.log(suiteName);
      suites[suiteName].on('cycle', (event) => beauty.add(event.target));
      suites[suiteName].on('complete', (event) => {
        beauty.log();
        next();
      });
      suites[suiteName].run({ async: true });
    },
  );
};

module.exports = {
  benchmarks,
  createSuite,
  createSuites,
  suites,
  launch,
};
