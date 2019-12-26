import * as natural from 'natural';
import * as fs from 'fs';
import { Chain } from './Chain';
import { normalize } from './utils';

export class Markov {
  private chain: Chain;
  private tokens: string[][] = [];

  // Default tries
  private attempts: number = 50;

  // Default max overlap ratio
  private mor: number = .7;

  // Default max overlap total
  private mot: number = 15;

  // An integer, indicating the number of words in the model's state.
  private stateSize: number = 2;
  private markovPath: string;

  constructor(stateSize: number = 2, markovPath: string) {
    this.stateSize = stateSize;
    this.markovPath = markovPath;
    this.chain = new Chain(this.stateSize);

    // Init Markov file
    if (!fs.existsSync(this.markovPath)) {
      fs.writeFileSync(this.markovPath, JSON.stringify({}));
    }
  }

  public index(corpus: string, nicknames?: string[][]) {
    const tokenizer = new natural.SentenceTokenizer();
    const sentenceTokens = tokenizer.tokenize(corpus);
    sentenceTokens.forEach(sentence => this.indexSentence(sentence, nicknames));
  }

  public tokenizeSentence(input: string): string[] {
    const tokenizer = new natural.RegexpTokenizer({ pattern: /\-| |\'|,/ });
    return tokenizer
      .tokenize(input)
      .filter(token => token !== '');
  }

  public indexSentence(sentence: string, nicknames?: string[][]) {
    const tokens = this.tokenizeSentence(sentence)
      .map(token => normalize(token))
      .filter(token => /\w/.test(token));

    if (tokens.length > 0) {
      this.tokens.push(tokens);
    }

    // Transform
    if (nicknames && tokens.length > 0) {
      nicknames.forEach((alias) => {
        const nameFoundIndex = alias.findIndex(name => tokens.indexOf(normalize(name)) > -1);

        if (nameFoundIndex > -1) {
          const nameFound = alias[nameFoundIndex];
          const otherNames = [...alias];

          otherNames.splice(nameFoundIndex, 1);
          otherNames.forEach((name) => {
            const newSentenceTokens = this.tokenizeSentence(sentence.replace(nameFound, name))
              .map(token => normalize(token))
              .filter(token => /\w/.test(token));

            if (newSentenceTokens.length > 0) {
              this.tokens.push(newSentenceTokens);
            }
          });
        }
      });
    }
  }

  public train() {
    this.chain.buildModel(this.tokens);
  }

  public load() {
    this.chain.loadModel(this.markovPath);
  }

  public save() {
    this.chain.saveModel(this.markovPath);
  }

  public replaceWord(currentWord: string, replaceWord: string) {
    this.chain.replaceWord(normalize(currentWord), normalize(replaceWord));
  }

  public getWords() {
    return this.chain.getWords();
  }

  public getSpellCheck() {
    const words = this.getWords();
    const spellCheck = new natural.Spellcheck(words);

    const res = {};

    words.forEach((word) => {
      const corrections = spellCheck.getCorrections(word, 1);

      // Possible output: table: [ 'table' ]
      const wordIndex = corrections.indexOf(word);
      const sameCorrection = corrections.length === 1 && wordIndex === 0;

      if (corrections.length > 0 && corrections.length < 4 && !sameCorrection) {
        res[word] = corrections.filter(w => w !== word);
      }
    });

    return res;
  }

  private rejoinedText() {
    return (this.tokens.map(run => run.join(' '))).join(' ');
  }

  private testOutput(words, mor, mot): boolean {
    const overlapRatio = Math.round(mor * words.length);
    const overlapMax = Math.min(mot, overlapRatio);
    const overlapOver = overlapMax + 1;
    const gramCount = Math.max((words.length - overlapMax), 1);
    const grams = [...Array(gramCount).keys()].map(i => words.slice(i, i + overlapOver));

    // If any matches, return false
    return !grams.some((gram) => {
      const gramJoined = gram.join(' ');
      if (this.rejoinedText().indexOf(gramJoined) !== -1) {
        return true;
      }
    });
  };

  public makeSentence(subject: string|null, minLength: number = 5, maxLength: number = 500): string|null {
    let sentence = null;

    for (let i = 0; i < this.attempts; i++) {
      const words: string[] = this.chain.generate(subject ? normalize(subject) : null);

      if (this.testOutput(words, this.mor, this.mot)){
        sentence = words.join(' ');

        if (sentence.length < maxLength && sentence.length > minLength) {
          break;
        }
      }
    }

    return sentence;
  }
}
