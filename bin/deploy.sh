#!/bin/bash

set -e
set -o pipefail

ZIP_FILE="boty.zip"

helpFunction()
{
  echo ""
  echo "Usage: $0 -k key -h host -p path"
  echo -e "\t-k The public key"
  echo -e "\t-h The target host"
  echo -e "\t-r Restart the app with pm2 (yes/no)"
  exit 1 # Exit script after printing help
}

while getopts "k:h:r:" opt
do
  case "$opt" in
    k ) key="$OPTARG" ;;
    h ) host="$OPTARG" ;;
    r ) restart="$OPTARG" ;;
    ? ) helpFunction ;; # Print helpFunction in case parameter is non-existent
  esac
done

# Print helpFunction in case parameters are empty
if [ -z "$key" ] || [ -z "$host" ] || [ -z "$restart" ]
then
  echo "Some or all of the parameters are empty";
  helpFunction
fi

# Zip project
echo "Preparing zip..."

{
  zip -r "$ZIP_FILE" package.json src/ data/stopwords.txt start.ts tsconfig.json tslint.json types/ .env
} &> /dev/null

echo "Uploading zip..."

{
  # Upload via SSH
  scp -i "$key" "$ZIP_FILE" "$host":

  # Remove local zip
  rm "$ZIP_FILE"
} &> /dev/null

# SSH login
ssh -T -i "$key" "$host" << EOF

{
  # Unzip
  unzip -o "$ZIP_FILE" -d boty

  # Remove host zip
  rm "$ZIP_FILE"

  # Install dependencies
  echo "Installing..."

  cd boty
  npm install

  # Generate dist (production ready files) files
  npm run build

  # Restart
  if [ ${restart,,} = "yes" ] || [ ${restart,,} = "y" ]
  then
    pm2 restart boty
  fi

  # Exit
  exit
} &> /dev/null

EOF

echo "Done"

exit
