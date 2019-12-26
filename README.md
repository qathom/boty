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

# Spell check: see possible errors and suggested corrections
/spellcheck

# Replace wrong written words
/replace_word wrongWord correctWord

# Retrieve the total of unique words
/count_words

# Removes the bot from the group
/bye
```

## Deployment

### Serverless

```bash
# Install serverless
npm i -g serverless

# Deploy
npm run deploy:serverless

# Set the webhook
curl -F "url=https://xxx.execute-api.eu-west-3.amazonaws.com/prod/webhook" https://api.telegram.org/bot<TOKEN>/setWebhook
```

### Server

You can use the `deploy.sh` script to deploy the bot on your server.
It generates a zip file, uploads the project to your server (boty folder) and install dependencies:

```bash
chmod +x ./bin/deploy.sh

# Usage
./bin/deploy.sh -k key.pem -h xxx@ec2-xxxxx.eu-west-3.compute.amazonaws.com -r no
```

Alternatively, you can follow the below guide:

```bash
# Zip project
zip -r boty.zip package.json src/ data/ start.ts tsconfig.json tslint.json types/ .env

# Upload via SSH
scp -i key.pem boty.zip user@ec2-xxx.eu-west-3.compute.amazonaws.com:

# Remove local zip
rm boty.zip

# SSH login
ssh -i key.pem ec2-user@xxx.eu-west-3.compute.amazonaws.com

# Unzip
unzip boty.zip -d boty

# Install dependencies
cd boty
npm install

# Generate dist (production ready files) files
npm run build

# Run with pm2
pm2 start dist/start.js --name boty

# For automatically running PM2 when the server restarts, issue the following command
pm2 startup

# Save all the currently running processes so that they can be run again
# whenever PM2 restarts either manually or by a script with the following command
pm2 save
