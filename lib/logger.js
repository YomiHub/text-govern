'use strict';

const chalk = require('chalk');

const PREFIX = '[text-govern]';

const logger = {
  info(msg) {
    console.log(chalk.cyan(PREFIX), msg);
  },
  success(msg) {
    console.log(chalk.green(PREFIX), chalk.green('✔'), msg);
  },
  warn(msg) {
    console.warn(chalk.yellow(PREFIX), chalk.yellow('⚠'), msg);
  },
  error(msg) {
    console.error(chalk.red(PREFIX), chalk.red('✖'), msg);
  },
  step(n, total, msg) {
    console.log(chalk.blue(PREFIX), chalk.blue(`[${n}/${total}]`), msg);
  },
  dim(msg) {
    console.log(chalk.dim(PREFIX), chalk.dim(msg));
  },
};

module.exports = logger;
