import { Bot } from './src/Bot';

// Load dotenv
require('dotenv').config();

// Setup bot
const bot = new Bot({
  token: process.env.TELEGRAM_TOKEN,
  configPath: './data/config.json',
  markovPath: './data/markov.json',
});

console.log('Launching...');

bot.start();

console.log('Boty is now ready!');
