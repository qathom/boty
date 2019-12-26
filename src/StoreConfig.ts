import * as fs from 'fs';
import { StoreConfigSchema, GroupSchema } from '@@/types';

export class StoreConfig {
  private filePath: string;
  private model: StoreConfigSchema;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.initStore();
  }

  private initStore(): void {
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify({
        lastUpdate: new Date().toISOString(),
        groups: [],
      }));
    }

    this.read();
  }

  private read(): void {
    const data = fs.readFileSync(this.filePath, 'utf-8');
    this.model = JSON.parse(data);
  }

  private newGroup(id: number, nicknames: string[][] = [], responseRate: number = 1): GroupSchema {
    return {
      id,
      nicknames,
      responseRate,
      messagesReceived: 0,
    };
  }

  private validateNicknames(nicknames: string[][]): boolean {
    if (!Array.isArray(nicknames)) {
      throw new Error('Validation error: invalid array');
    }

    nicknames.forEach((group) => {
      group.forEach((name) => {
        if (typeof name !== 'string') {
          throw new Error('Validation error: invalid nickname type');
        }
      });
    });

    return true;
  }

  setNicknames(groupId: number, nicknames: string[][]): void {
    this.validateNicknames(nicknames);

    const configIndex = this.model.groups.findIndex(({ id }) => id === groupId);
    if (configIndex === -1) {
      this.model.groups.push(this.newGroup(groupId, nicknames));
      return;
    }

    this.model.groups[configIndex].nicknames = nicknames;
  }

  getNicknames(groupId: number): string[][] {
    const configIndex = this.model.groups.findIndex(({ id }) => id === groupId);

    if (configIndex === -1) {
      return [];
    }

    return this.model.groups[configIndex].nicknames;
  }

  private validateResponseRate(rate: number): boolean {
    if (rate < 1 || rate > 100 || !Number.isInteger(rate)) {
      throw new Error(`Invalid response rate: ${rate}`);
    }

    return true;
  }

  setResponseRate(groupId: number, rate: number): void {
    this.validateResponseRate(rate);

    const configIndex = this.model.groups.findIndex(({ id }) => id === groupId);

    if (configIndex === -1) {
      this.model.groups.push(this.newGroup(groupId, [], rate));
      return;
    }

    this.model.groups[configIndex].responseRate = rate;
  }

  getResponseRate(groupId: number): number {
    const configIndex = this.model.groups.findIndex(({ id }) => id === groupId);

    if (configIndex === -1) {
      return 1;
    }

    return this.model.groups[configIndex].responseRate;
  }

  incrementMessagesReceived(groupId: number): number {
    const configIndex = this.model.groups.findIndex(({ id }) => id === groupId);

    if (configIndex === -1) {
      this.model.groups.push(this.newGroup(groupId));
      return;
    }

    this.model.groups[configIndex].messagesReceived += 1;

    return this.model.groups[configIndex].messagesReceived;
  }

  resetMessagesReceived(groupId: number) {
    const configIndex = this.model.groups.findIndex(({ id }) => id === groupId);

    if (configIndex === -1) {
      return 1;
    }

    return this.model.groups[configIndex].messagesReceived = 0;
  }

  save(): void {
    const data = {
      lastUpdate: new Date().toISOString(),
      groups: [...this.model.groups],
    };

    fs.writeFileSync(this.filePath, JSON.stringify(data));
  }
}
