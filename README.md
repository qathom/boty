# Boty

> Talkative mad bot for your Telegram group chats

## Install

```bash
npm install

# Add your Telegram token in the .env file
cp .env.example .env
```

## Usage

### Server

```bash
# Dev
npm run start:dev

# Prod
npm run build
npm run start
```

### Bot commands

Run below commands in a Telegram group:

```bash
# Set nicknames for the group users
/set_nicknames [["William", "Will"], ["Alexander", "Al", "Alex"]]

# Retrieve the list of nicknames of the group
/get_nicknames

# Set a response rate (here, boty will reply after every 3 messages)
/set_response_rate 3

# Retrieve the current response rate
/get_response_rate

# Removes the bot from the group
/bye
```
