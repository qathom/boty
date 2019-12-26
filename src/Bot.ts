import Telegraf from 'telegraf';
import * as fs from 'fs';
import * as rateLimit from 'telegraf-ratelimit';
import { StoreConfig } from './StoreConfig';
import { Markov } from './Markov';
import { normalize, getRandom } from './utils';
import { BotOptions, ParsedMessage } from '@@/types';

export class Bot {
  private storeConfig: StoreConfig;
  private options: BotOptions;
  private markov: Markov;
  private stopWordFilePath: string = './data/stopwords.txt';
  private limitConfig = {
    window: 1000, // Seconds
    limit: 5, // number of messages
    onLimitExceeded: (ctx, next) => ctx.reply('Calm down! Rate limit exceeded'),
  };
  private telegraf: Telegraf<any>;

  constructor(options: BotOptions) {
    this.options = options;

    // Telegram group configs
    this.storeConfig = new StoreConfig(this.options.configPath);

    // Markov
    this.markov = new Markov(2, this.options.markovPath);

    // Load markov model
    this.markov.load();

    // Set bot
    this.telegraf = new Telegraf(this.options.token);
  }

  private parseMessage(message: string): ParsedMessage {
    // Transform \n to dot
    let output = message.replace(/\r?\n|\r/gm, '.');

    // Check if it is a paragraph
    const containsSentences = /\.[\w\W]+/g.test(output);

    // End with correct dot
    if (containsSentences) {
      const lastChar = output.slice(-1);
      output = lastChar === '.' ? output : `${output}.`;
    }

    return { message: output, hasSentences: containsSentences };
  }

  private onMessage(context) {
    const groupId: number = context.message.chat.id;
    const inputMessage = context.message.text;
    const user = context.message.from.username;

    // Ignore links
    if (/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}/g.test(inputMessage)) {
      return;
    }

    const { message, hasSentences } = this.parseMessage(inputMessage);
    const nicknames = this.storeConfig.getNicknames(groupId);

    if (hasSentences) {
      this.markov.index(message, nicknames);
    } else {
      this.markov.indexSentence(message, nicknames);
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

    const topic = this.findTopic(message, nicknames);
    const sentence = this.markov.makeSentence(topic, 1, 100) ||
      this.markov.makeSentence(null, 1, 100);

    if (!sentence) {
      return;
    }

    this.storeConfig.resetMessagesReceived(groupId);
    this.storeConfig.save();

    // Answer back if "boty" is in the sentence
    const finalSentence: string = sentence.replace(/boty/g, user);

    context.reply(finalSentence);
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
      // Remove stopwords followed by at least one empty space
      const regexp = new RegExp(`(${stopword})[ ]+`, 'g');

      cleanMessage = cleanMessage
        .replace(regexp, ' ');
    });

    // Apply normalization after removing stopwords
    // Stopwords are available in several languages
    const normalizedMessage = normalize(cleanMessage);

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
    this.telegraf.command('bye', (ctx) => {
      ctx.reply('Bye!');
      ctx.leaveChat();
    });

    this.telegraf.command('set_nicknames', (ctx) => {
      const groupId = ctx.message.chat.id;

      try {
        const textAliases = ctx.message.text.replace(/\/set_nicknames/, '');
        const nicknames = JSON.parse(textAliases);

        this.storeConfig.setNicknames(groupId, nicknames);
        this.storeConfig.save();

        ctx.reply('New nicknames saved!');
      } catch (e) {
        console.error(e);
        ctx.reply('Invalid nicknames');
      }
    });

    this.telegraf.command('get_nicknames', (ctx) => {
      const groupId = ctx.message.chat.id;

      try {
        const res = this.storeConfig.getNicknames(groupId);
        ctx.reply(`Nicknames: ${JSON.stringify(res)}`);
      } catch (e) {
        console.error(e);
        ctx.reply('Invalid nicknames');
      }
    });

    this.telegraf.command('set_response_rate', (ctx) => {
      const groupId = ctx.message.chat.id;

      try {
        const arg = ctx.message.text.replace(/\/set_response_rate/, '');
        const responseRate = Number.parseInt(arg, 10);

        this.storeConfig.setResponseRate(groupId, responseRate);
        this.storeConfig.save();

        ctx.reply(`New response rate saved! ${responseRate}`);
      } catch (e) {
        console.error(e);
        ctx.reply('Oups! The response rate value must be between 1 and 100');
      }
    });

    this.telegraf.command('get_response_rate', (ctx) => {
      const groupId = ctx.message.chat.id;

      try {
        const res = this.storeConfig.getResponseRate(groupId);
        ctx.reply(`Response rate: ${JSON.stringify(res)}`);
      } catch (e) {
        console.error(e);
        ctx.reply('Oups! Something went wrong while saving the new response rate');
      }
    });

    this.telegraf.command('spellcheck', (ctx) => {
      try {
        const corrections = this.markov.getSpellCheck();
        const words = Object.keys(corrections);

        // Sort words
        words.sort();

        const output = words
          .reduce((out, word) => `${out}${word}: ${corrections[word].join(',')}\n`, '');
        ctx.reply(`Possible corrections (For ${words.length} words):\n\n${output}`);
      } catch (e) {
        console.error(e);
        ctx.reply('Oups! Something went wrong');
      }
    });

    this.telegraf.command('count_words', (ctx) => {
      try {
        const uniqueWords = this.markov.getWords();
        ctx.reply(`Total unique words: ${uniqueWords.length}`);
      } catch (e) {
        console.error(e);
        ctx.reply('Oups! Something went wrong');
      }
    });

    this.telegraf.command('replace_word', (ctx) => {
      try {
        const args = ctx.message.text
          .replace(/\/replace_word/, '')
          .trim();
        const match = args.match(/^([\w]+) ([\w]+)/g);

        if (!match || match.length !== 1) {
          throw new Error('Invalid arguments');
        }

        const [currentWord, replaceWord] = match[0].split(' ');

        this.markov.replaceWord(currentWord, replaceWord);
        this.markov.save();

        ctx.reply(`Word "${currentWord}" has been replaced by "${replaceWord}"`);
      } catch (e) {
        console.error(e);
        ctx.reply('Oups! Something went wrong');
      }
    });
  }

  public getTelegrafInstance() {
    return this.telegraf;
  }

  public register() {
    this.telegraf.use(rateLimit(this.limitConfig));

    // Commands
    this.registerCommands();

    // Listen to text stream
    this.telegraf.on('text', context => this.onMessage(context));
  }

  public start() {
    this.register();

    // Start
    this.telegraf.startPolling();
  }
}
