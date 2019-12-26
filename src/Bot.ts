import Telegraf from 'telegraf';
import * as fs from 'fs';
import * as rateLimit from 'telegraf-ratelimit';
import { StoreConfig } from './StoreConfig';
import { Markov } from './Markov';
import { normalize, getRandom } from './utils';
import { BotOptions } from '@@/types';

export class Bot {
  private storeConfig: StoreConfig;
  private options: BotOptions;
  private markov: Markov;
  private stopWordFilePath: string = './data/stopwords.txt';
  private limitConfig = {
    window: 1000, // Seconds
    limit: 2, // number of messages
    onLimitExceeded: (ctx, next) => ctx.reply('Calm down! Rate limit exceeded'),
  };
  private bot: Telegraf<any>;

  constructor(options: BotOptions) {
    this.options = options;

    // Telegram group configs
    this.storeConfig = new StoreConfig(this.options.configPath);

    // Markov
    this.markov = new Markov(2, this.options.markovPath);

    // Load markov model
    this.markov.load();

    // Set bot
    this.bot = new Telegraf(this.options.token);
  }

  private parseMessage(message: string) {
    // Transform \n to dot
    return message.replace(/\r?\n|\r/gm, '.');
  }

  private onMessage(groupId: number, message: string, ctx) {
    // Ignore links
    if (/^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}/g.test(message)) {
      return;
    }

    let messageBreak = this.parseMessage(message);
    const nicknames = this.storeConfig.getNicknames(groupId);
    const containsSentences = /\.[\w\W]+/g.test(messageBreak);
    
    if (containsSentences) {
      const lastChar = messageBreak.slice(-1);
      messageBreak = lastChar === '.' ? messageBreak : `${messageBreak}.`;
      this.markov.index(messageBreak, nicknames);
    } else {
      this.markov.indexSentence(messageBreak, nicknames);
    }

    // Update the training
    this.markov.train();
    this.markov.save();

    // Slow down the response rate if needed
    const newValue = this.storeConfig.incrementMessagesReceived(groupId);
    const responseRate = this.storeConfig.getResponseRate(groupId);

    if (newValue < responseRate) {
      this.storeConfig.save();
      return;
    }

    this.storeConfig.resetMessagesReceived(groupId);
    this.storeConfig.save();

    const topic = this.findTopic(messageBreak, nicknames);
    const genRandom = this.markov.makeSentence(topic, 1, 150);

    if (genRandom) {
      ctx.reply(genRandom);
    }
  }

  private findTopic(message: string, nicknames: string[][]): string|null {
    // Get a list of topic candidates
    let candidates: string[] = [];

    // Get the list of stopwords
    let stopwords = [];

    if (fs.existsSync(this.stopWordFilePath)) {
      stopwords = fs
        .readFileSync(this.stopWordFilePath, 'utf-8')
        .split(/\r?\n/);
    }

    // Transform the message to lower case
    let cleanMessage = message.toLowerCase();

    stopwords.forEach((stopword) => {
      const regexp = new RegExp(`/${stopword}[\W]/`);

      cleanMessage = cleanMessage
        .replace(regexp, '')
        .trim();
    });

    // Apply normalization after removing stopwords
    // Stopwords are available in several languages
    const normalizedMessage = normalize(message);
    const people: string[] = nicknames
      .reduce((list, names) => [...list, ...names], [])
      .map(name => normalize(name));

    const aboutPeople = people
      .filter(name => normalizedMessage.indexOf(name) > -1);

    // Get a list of relevant people
    if (aboutPeople.length > 0) {
      candidates = [...candidates, ...aboutPeople];
    }

    const tokens = this.markov
      .tokenizeSentence(normalize(cleanMessage));

    if (tokens.length > 0) {
      candidates = [...candidates, ...tokens];
    }

    // Unique list
    candidates = [...new Set(candidates)];

    if (candidates.length > 0) {
      const randomIndex = getRandom(0, candidates.length - 1);
      return candidates[randomIndex];
    }

    return null;
  }

  private registerCommands() {
    this.bot.command('bye', (ctx) => {
      ctx.reply('Bye!');
      ctx.leaveChat();
    });

    this.bot.command('set_nicknames', (ctx) => {
      const groupId = ctx.message.chat.id;
    
      try {
        const textAliases = ctx.message.text.replace(/\/set_nicknames/, '');
        const nicknames = JSON.parse(textAliases);
    
        this.storeConfig.setNicknames(groupId, nicknames);
        this.storeConfig.save();

        ctx.reply('New nickname saved!');
      } catch (e) {
        console.error(e);
        ctx.reply('Invalid nicknames');
      }
    });
    
    this.bot.command('get_nicknames', (ctx) => {
      const groupId = ctx.message.chat.id;
    
      try {
        const res = this.storeConfig.getNicknames(groupId);
        ctx.reply(`Nicknames: ${JSON.stringify(res)}`);
      } catch (e) {
        console.error(e);
        ctx.reply('Invalid nicknames');
      }
    });

    this.bot.command('set_response_rate', (ctx) => {
      const groupId = ctx.message.chat.id;
    
      try {
        const arg = ctx.message.text.replace(/\/set_response_rate/, '');
        const responseRate = Number.parseInt(arg);
    
        this.storeConfig.setResponseRate(groupId, responseRate);
        this.storeConfig.save();

        ctx.reply('New response rate saved!');
      } catch (e) {
        console.error(e);
        ctx.reply('Invalid response rate');
      }
    });
    
    this.bot.command('get_response_rate', (ctx) => {
      const groupId = ctx.message.chat.id;
    
      try {
        const res = this.storeConfig.getResponseRate(groupId);
        ctx.reply(`Response rate: ${JSON.stringify(res)}`);
      } catch (e) {
        console.error(e);
        ctx.reply('Invalid response rate');
      }
    });
  }

  public start() {
    this.bot.use(rateLimit(this.limitConfig));
    
    // Commands
    this.registerCommands();
  
    // Listen to text stream
    this.bot.on('text', (ctx) => {
      this.onMessage(ctx.message.chat.id, ctx.message.text, ctx);
    });

    // Start
    this.bot.startPolling();
  }
}
