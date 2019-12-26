import { Bot } from './src/Bot';
import { APIGatewayEvent } from 'aws-lambda';
import * as fs from 'fs';

/**
 * AWS lambda function
 * Webhook
 */
module.exports.webhook = async (event: APIGatewayEvent): Promise<any> => {
  // @ts-ignore
  const body = event.body[0] === '{' ? JSON.parse(event.body) : JSON.parse(Buffer.from(event.body, 'base64'));

  /*
   * AWS Lambda functions allow file operations
   * in tmp/ only
   */
  const dir = '/tmp';

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  // Setup bot
  const bot = new Bot({
    token: process.env.TELEGRAM_TOKEN,
    configPath: `${dir}/config.json`,
    markovPath: `${dir}/markov.json`,
  });

  console.log('Launching...');

  // Register commands, etc.
  bot.register();

  const telegraf = bot.getTelegrafInstance();

  // Handle updates
  await telegraf.handleUpdate(body);

  // return something for webhook, so it doesn't try to send same stuff again
  return { statusCode: 200, body: '' };
};
