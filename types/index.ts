export type GroupSchema = {
  id: number,
  nicknames: string[][],
  responseRate: number,
  messagesReceived: number,
};

export type StoreConfigSchema = {
  lastUpdate: string;
  groups: GroupSchema[];
};

export type BotOptions = {
  token: string;
  configPath: string;
  markovPath: string;
};

export type ParsedMessage = {
  message: string;
  hasSentences: boolean;
};

export type ChainSchema = {
  // N-Gram as a key
  [key: string]: {
    // Unique word and frequency
    [key: string]: number,
  },
};
