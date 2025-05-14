#!/bin/bash

# Prompt for username instead of taking it as an argument
read -p "Enter username: " USERNAME

# Create credentials directory if it doesn't exist
if [ ! -d "${CREDENTIALS_DIR}/${USERNAME}" ]; then
    mkdir -p ${CREDENTIALS_DIR}/${USERNAME}
fi

# Check and create ${USERNAME}'s node credentials
if [ -f "${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-node.vk" ] && [ -f "${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-node.sk" ] && [ -f "${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-node.addr" ]; then
    echo "${USERNAME}'s node credentials already exist. Skipping creation."
else
    cardano-cli address key-gen \
      --verification-key-file ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-node.vk \
      --signing-key-file ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-node.sk

    cardano-cli address build \
      --verification-key-file ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-node.vk \
      --out-file ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-node.addr
fi


# Check and create ${USERNAME}'s funds credentials
if [ -f "${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.vk" ] && [ -f "${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.sk" ] && [ -f "${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.addr" ]; then
    echo "${USERNAME}'s funds credentials already exist. Skipping creation."
else
    cardano-cli address key-gen \
      --verification-key-file ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.vk \
      --signing-key-file ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.sk

    cardano-cli address build \
      --verification-key-file ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.vk \
      --out-file ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.addr
fi

# Check if there's a .env file in the project directory and compare username
if [ -f "${PROJECT_ROOT}/.env" ]; then
    # Extract existing username from .env file
    EXISTING_USERNAME=$(grep "^USERNAME=" "${PROJECT_ROOT}/.env" | cut -d '=' -f2)
    
    # Remove quotes if present
    EXISTING_USERNAME="${EXISTING_USERNAME//\"/}"
    EXISTING_USERNAME="${EXISTING_USERNAME//\'/}"
    
    # Compare with entered username
    if [ -n "$EXISTING_USERNAME" ] && [ "$EXISTING_USERNAME" != "$USERNAME" ]; then
        echo "Found different username in .env file: $EXISTING_USERNAME"
        read -p "Would you like to update the username in .env to $USERNAME? (y/n): " UPDATE_CHOICE
        
        if [[ "$UPDATE_CHOICE" =~ ^[Yy]$ ]]; then
            # Update the username in the .env file
            if [[ "$OSTYPE" == "darwin"* ]]; then
                # macOS requires an empty string for -i
                sed -i '' "s/^USERNAME=.*$/USERNAME=$USERNAME/" "${PROJECT_ROOT}/.env"
            else
                # Linux version
                sed -i "s/^USERNAME=.*$/USERNAME=$USERNAME/" "${PROJECT_ROOT}/.env"
            fi
            echo "Username updated in .env file"
        else
            echo "Keeping existing username ($EXISTING_USERNAME) in .env file"
            # Optionally update the USERNAME variable for the rest of this script
            USERNAME="$EXISTING_USERNAME"
        fi
    fi
fi