import * as fs from 'fs';
import { ChainSchema } from '@@/types';

// Tags
const BEGIN = '__BEGIN__';
const END = '__END__';

/**
 * Inspiration:
 * https://github.com/jsvine/markovify/blob/master/markovify/chain.py
 */
export class Chain {
  private initialState: any[] = [];
  private model: ChainSchema = {};
  private stateSize: number = 2;
  private validModel: boolean = false;

  constructor(stateSize: number) {
    this.stateSize = stateSize;

    [...Array(stateSize).keys()].forEach(() => {
      this.initialState.push(BEGIN);
    });
  }

  public loadModel(filePath: string) {
    this.model = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    this.validModel = true;
  }

  public saveModel(filePath: string) {
    fs.writeFileSync(filePath, JSON.stringify(this.model));
  }

  public getWords(): string[] {
    let words: string[] = [];

    Object.keys(this.model).forEach((nGram: string) => {
      const singleWords = Object.keys(this.model[nGram]);
      words = [...words, ...singleWords];
    });

    return [...new Set(words)];
  }

  public replaceWord(currentWord: string, replaceWord: string) {
    const previousNGrams: string[] = [];

    Object.keys(this.model).forEach((nGram: string) => {
      const tokens = nGram.split(' ');

      if (tokens.indexOf(currentWord) > -1) {
        previousNGrams.push(nGram);
      }

      if (tokens.indexOf(currentWord) === -1) {
        // Inner search
        if (Object.keys(this.model[nGram]).findIndex(w => w === currentWord) > -1) {
          previousNGrams.push(nGram);
        }
      }
    });

    // Merge existing words in N-Grams
    const newModel = { ...this.model };

    previousNGrams.forEach((nGram) => {
      const newKey = nGram.replace(currentWord, replaceWord);

      if (!newModel[newKey]) {
        newModel[newKey] = {};
      }

      // Merge existing next word
      const mergeWordWords = Object
        .keys(newModel[nGram]);

      mergeWordWords.forEach((mergeWord) => {
        if (mergeWord === replaceWord) {
          return;
        }

        if (mergeWord === currentWord) {
          const newStats: number = newModel[nGram][currentWord] + (newModel[newKey][replaceWord] || 0);
          newModel[newKey][replaceWord] = newStats;
          return;
        }

        const updateStats: number = newModel[nGram][mergeWord] + (newModel[newKey][mergeWord] || 0);
        newModel[newKey][mergeWord] = updateStats;
      });

      // Word clean-up
      if (nGram !== newKey) {
        delete newModel[nGram];
      }

      if (currentWord in newModel[newKey]) {
        delete newModel[nGram][currentWord];
      }
    });


    // Update model
    this.model = newModel;
  }

  public buildModel(tokens: string[][]) {
    tokens.forEach((run) => {
      const items = [...this.initialState, ...run];
      items.push(END);

      [...Array(run.length + 1).keys()].forEach((el ,i) => {
        const state = this.tupleToString(items.slice(i, i + this.stateSize));
        const follow = items[i + this.stateSize];

        if (!this.model.hasOwnProperty(state)) {
          this.model[state] = {};
        }

        if (!this.model[state].hasOwnProperty(follow)) {
          this.model[state][follow] = 0;
        }

        this.model[state][follow]++;
      });
    });

    this.validModel = true;
  }

  private tupleToString(tuple: string[]): string {
    return tuple.join(' ');
  }

  private move(topic: string, state) {
    // Pick next word at random
    const modelState = this.model[this.tupleToString(state)];
    const list: string[] = [];

    Object.keys(modelState).forEach((key) => {
      [...Array(modelState[key]).keys()].forEach((test) => {
        list.push(key);
      });
    });

    const sample = (arr) => {
      const index = arr.indexOf(topic);
      if (index > -1) {
        return arr[index];
      }

      const len = arr == null ? 0 : arr.length;
      return len ? arr[Math.floor(Math.random() * len)] : undefined;
    };

    return sample(list);
  }

  /**
   * Starting with a naive BEGIN state, if a given topic is provided, it will
   * find it in move()
   * Return a generator that will yield successive items
   * until the chain reaches the END state.
   *
  **/
  public generate(topic?: string|null) {
    if (!this.validModel) {
      throw new Error('Markov.Chain: the model is not valid! Make sure to call buildModel() or loadModel()');
    }

    let state = [];

    [...Array(this.stateSize).keys()].forEach(() => {
      state.push(BEGIN);
    });

    const words = [];

    while (true) {
      // Move was not accepted here ?
      const nextWord = this.move(topic, state);

      if (nextWord === END) {
        break;
      }

      words.push(nextWord);
      state = state.slice(1);
      state.push(nextWord);
    }

    return words;
  }
}
